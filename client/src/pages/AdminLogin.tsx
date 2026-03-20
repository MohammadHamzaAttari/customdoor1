import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, User } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";

export default function AdminLogin() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      setLocation("/admin");
    }
  }, [user, setLocation]);

  const onSubmit = (data: InsertUser) => {
    loginMutation.mutate(data);
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
            <Lock className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-black text-stone-800 tracking-tight">Admin Portal</CardTitle>
          <CardDescription className="text-stone-500 font-medium">Please sign in to manage system settings</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-stone-500 ml-1">Username</Label>
              <div className="relative group">
                <User className="absolute left-3 top-3 w-4 h-4 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  id="username"
                  {...form.register("username")}
                  placeholder="Enter your username"
                  className="pl-10 h-11 bg-stone-50/50 border-stone-200 focus:bg-white transition-all shadow-sm"
                />
              </div>
              {form.formState.errors.username && (
                <p className="text-xs font-medium text-red-500 mt-1 ml-1">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-stone-500 ml-1">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  placeholder="Enter your password"
                  className="pl-10 h-11 bg-stone-50/50 border-stone-200 focus:bg-white transition-all shadow-sm"
                />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs font-medium text-red-500 mt-1 ml-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end -mt-4">
              <Link href="/admin/forgot-password">
                <a className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors">
                  Forgot password?
                </a>
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-stone-800 hover:bg-stone-900 text-white font-bold transition-all shadow-lg active:scale-[0.98]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
