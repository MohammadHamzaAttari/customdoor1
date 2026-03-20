import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Key } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchString = window.location.search;
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const form = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Reset failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Password reset successfully. You can now login.");
      setTimeout(() => setLocation("/admin/login"), 2000);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="w-full max-w-md p-8 text-center">
          <CardTitle className="text-red-500">Invalid Link</CardTitle>
          <CardDescription>The password reset link is missing a token.</CardDescription>
          <Button className="mt-4" onClick={() => setLocation("/admin/login")}>Back to Login</Button>
        </Card>
      </div>
    );
  }

  const onSubmit = (data: ResetPasswordData) => {
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-orange-50/30 p-4">
      <Card className="w-full max-w-md shadow-2xl border-stone-100/50 backdrop-blur-sm bg-white/80 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-2 text-center pb-8 border-b border-stone-50">
          <div className="mx-auto bg-orange-100 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-orange-200 shadow-inner">
            <Key className="w-6 h-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-black text-stone-800 tracking-tight">Set New Password</CardTitle>
          <CardDescription className="text-stone-500 font-medium">
            Please enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-stone-500 ml-1">New Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  id="password"
                  type="password"
                  {...form.register("password")}
                  placeholder="At least 8 characters"
                  className="pl-10 h-11 bg-stone-50/50 border-stone-200 focus:bg-white transition-all shadow-sm"
                />
              </div>
              {form.formState.errors.password && (
                <p className="text-xs font-medium text-red-500 mt-1 ml-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-stone-500 ml-1">Confirm Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-stone-400 group-focus-within:text-orange-500 transition-colors" />
                <Input
                  id="confirmPassword"
                  type="password"
                  {...form.register("confirmPassword")}
                  placeholder="Repeat new password"
                  className="pl-10 h-11 bg-stone-50/50 border-stone-200 focus:bg-white transition-all shadow-sm"
                />
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs font-medium text-red-500 mt-1 ml-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-stone-800 hover:bg-stone-900 text-white font-bold transition-all shadow-lg active:scale-[0.98]"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
