import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const form = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Request failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: ForgotPasswordData) => {
    forgotPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-orange-50/30 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-200/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-stone-100/50 backdrop-blur-sm bg-white/80 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-2 text-center pb-8 border-b border-stone-50">
          <div className="mx-auto bg-orange-100 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-orange-200 shadow-inner">
            <Mail className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-black text-stone-800 tracking-tight">Reset Password</CardTitle>
          <CardDescription className="text-stone-500 font-medium">
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-stone-500 ml-1">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  id="email"
                  type="email"
                  {...form.register("email")}
                  placeholder="admin@example.com"
                  className="pl-10 h-11 bg-stone-50/50 border-stone-200 focus:bg-white transition-all shadow-sm"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs font-medium text-red-500 mt-1 ml-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-stone-800 hover:bg-stone-900 text-white font-bold transition-all shadow-lg active:scale-[0.98]"
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>

            <div className="text-center">
              <Link href="/admin/login">
                <a className="inline-flex items-center text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </a>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
