#!/bin/bash
set -euo pipefail
source aws-config.sh
source aws-resources.sh
source aws-rds-resources.sh

ACTION=${1:-help}

case $ACTION in

all)
    echo "╔══════════════════════════════════════╗"
    echo "║  Deploying Client + API              ║"
    echo "╚══════════════════════════════════════╝"

    echo "📦 Building Lambda..."
    ./build-lambda.sh

    echo "🚀 Updating Lambda..."
    aws lambda update-function-code \
        --function-name ${LAMBDA_NAME} \
        --zip-file fileb://lambda-package.zip \
        --region ${AWS_REGION} \
        --no-cli-pager > /dev/null

    aws lambda wait function-updated-v2 --function-name ${LAMBDA_NAME} --region ${AWS_REGION}

    NEW_VERSION=$(aws lambda publish-version \
        --function-name ${LAMBDA_NAME} \
        --query 'Version' --output text \
        --region ${AWS_REGION})

    aws lambda update-alias \
        --function-name ${LAMBDA_NAME} --name live \
        --function-version $NEW_VERSION \
        --region ${AWS_REGION} --no-cli-pager > /dev/null

    echo "✅ Lambda → v$NEW_VERSION"

    echo "📦 Building client..."
    npx vite build

    echo "🚀 Uploading to S3..."
    aws s3 sync dist/client/ s3://${CLIENT_BUCKET}/ \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --exclude "index.html" --exclude "*.json"

    aws s3 cp dist/client/index.html s3://${CLIENT_BUCKET}/index.html \
        --cache-control "public, max-age=0, must-revalidate" \
        --content-type "text/html"

    echo "🔄 Invalidating CloudFront..."
    aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID --paths "/*" \
        --query 'Invalidation.Id' --output text

    echo "✅ Done! 🌐 https://${CF_DOMAIN}"
    ;;

client)
    echo "📦 Building client..."
    npx vite build
    echo "🚀 Uploading..."
    aws s3 sync dist/client/ s3://${CLIENT_BUCKET}/ --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --exclude "index.html"
    aws s3 cp dist/client/index.html s3://${CLIENT_BUCKET}/index.html \
        --cache-control "public, max-age=0, must-revalidate" --content-type "text/html"
    echo "🔄 Invalidating..."
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID \
        --paths "/index.html" "/assets/*" --query 'Invalidation.Id' --output text
    echo "✅ Client deployed!"
    ;;

api)
    echo "📦 Building Lambda..."
    ./build-lambda.sh
    echo "🚀 Updating..."
    aws lambda update-function-code --function-name ${LAMBDA_NAME} \
        --zip-file fileb://lambda-package.zip --region ${AWS_REGION} --no-cli-pager > /dev/null
    aws lambda wait function-updated-v2 --function-name ${LAMBDA_NAME} --region ${AWS_REGION}
    NEW_VERSION=$(aws lambda publish-version --function-name ${LAMBDA_NAME} \
        --query 'Version' --output text --region ${AWS_REGION})
    aws lambda update-alias --function-name ${LAMBDA_NAME} --name live \
        --function-version $NEW_VERSION --region ${AWS_REGION} --no-cli-pager > /dev/null
    echo "✅ Lambda → v$NEW_VERSION"
    ;;

status)
    echo "=== Lambda ==="
    aws lambda get-function --function-name ${LAMBDA_NAME} --region ${AWS_REGION} \
        --query 'Configuration.{State:State,Runtime:Runtime,Memory:MemorySize,LastModified:LastModified}' \
        --output table 2>/dev/null || echo "❌ Not found"
    echo ""
    echo "=== API Health ==="
    curl -s "https://${CF_DOMAIN}/api/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "❌ Unreachable"
    echo ""
    echo "=== CloudFront ==="
    aws cloudfront get-distribution --id $DISTRIBUTION_ID \
        --query 'Distribution.{Status:Status,Domain:DomainName}' \
        --output table 2>/dev/null || echo "❌ Not found"
    echo "🌐 https://${CF_DOMAIN}"
    ;;

logs)
    aws logs tail /aws/lambda/${LAMBDA_NAME} --since 30m --format short --region ${AWS_REGION}
    ;;

logs-follow)
    aws logs tail /aws/lambda/${LAMBDA_NAME} --follow --format short --region ${AWS_REGION}
    ;;

migrate)
    echo "🗃️ Running migration..."
    DATABASE_URL=${DATABASE_URL} npx drizzle-kit push
    echo "✅ Done"
    ;;

seed-admin)
    echo "🌱 Seeding admin user..."
    DATABASE_URL=${DATABASE_URL} npx tsx seed_admin.ts
    echo "✅ Done"
    ;;

*)
    echo "Usage: ./deploy.sh <command>"
    echo "  all       Deploy client + API"
    echo "  client    Deploy frontend only"
    echo "  api       Deploy backend only"
    echo "  status    Check status"
    echo "  logs      View recent logs"
    echo "  logs-follow  Follow logs live"
    echo "  migrate   Run database migrations"
    echo "  seed-admin Seed the administrator user"
    ;;
esac
