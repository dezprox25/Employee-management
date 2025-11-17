'use client'
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SplashCursor from "@/components/SplashCursor";
import { Lock, Mail, User, Shield, Moon, Sun, Eye, EyeOff, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [activeTab, setActiveTab] = useState("employee");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [enableSplash, setEnableSplash] = useState(true);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsAdminLoading(true);

    try {
      // Basic client-side rate limiting
      const key = `loginAttempts:${adminEmail}:admin`;
      const lockKey = `lockUntil:${adminEmail}:admin`;
      const lockUntil = Number(localStorage.getItem(lockKey) || 0);
      
      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 60000);
        throw new Error(`Too many attempts. Try again in ${remaining} min`);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      
      if (error) throw error;

      // Get user role to verify admin access
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (userData?.role === "admin") {
          // Clear failed attempts on success
          localStorage.removeItem(key);
          localStorage.removeItem(lockKey);
          
          toast({
            title: "Login Successful",
            description: "Welcome back, Admin!",
          });
          
          router.push("/admin/dashboard");
        } else {
          await supabase.auth.signOut();
          throw new Error("Unauthorized. Admin access required.");
        }
      }
    } catch (error: unknown) {
      // Track failed attempts and lock after 5 failures for 5 minutes
      const key = `loginAttempts:${adminEmail}:admin`;
      const lockKey = `lockUntil:${adminEmail}:admin`;
      const attempts = Number(localStorage.getItem(key) || 0) + 1;
      localStorage.setItem(key, String(attempts));
      
      if (attempts >= 5) {
        localStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000));
        localStorage.removeItem(key);
      }
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsEmployeeLoading(true);

    try {
      // Basic client-side rate limiting
      const key = `loginAttempts:${employeeEmail}:employee`;
      const lockKey = `lockUntil:${employeeEmail}:employee`;
      const lockUntil = Number(localStorage.getItem(lockKey) || 0);
      
      if (lockUntil && Date.now() < lockUntil) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 60000);
        throw new Error(`Too many attempts. Try again in ${remaining} min`);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: employeeEmail,
        password: employeePassword,
      });
      
      if (error) throw error;

      // Get user role to redirect appropriately
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        // Clear failed attempts on success
        localStorage.removeItem(key);
        localStorage.removeItem(lockKey);
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });

        if (userData?.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/employee/dashboard");
        }
      }
    } catch (error: unknown) {
      // Track failed attempts and lock after 5 failures for 5 minutes
      const key = `loginAttempts:${employeeEmail}:employee`;
      const lockKey = `lockUntil:${employeeEmail}:employee`;
      const attempts = Number(localStorage.getItem(key) || 0) + 1;
      localStorage.setItem(key, String(attempts));
      
      if (attempts >= 5) {
        localStorage.setItem(lockKey, String(Date.now() + 5 * 60 * 1000));
        localStorage.removeItem(key);
      }
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsEmployeeLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-[#F5F5F7]'} relative overflow-hidden flex items-center justify-center p-4`}>
      {/* Animated Background */}
      <div className="absolute inset-0">
        {enableSplash && <SplashCursor />}
      </div>

      {/* Dark/Light Mode Toggle */}
      <div className="fixed top-6 right-6 z-20 flex gap-2">
        <motion.button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`p-3 rounded-full backdrop-blur-[40px] ${
            isDarkMode 
              ? 'bg-white/[0.08] border border-white/[0.18]' 
              : 'bg-black/[0.08] border border-black/[0.18]'
          } shadow-lg transition-all duration-300 hover:scale-110 active:scale-95`}
          whileHover={{ rotate: 180 }}
          transition={{ duration: 0.3 }}
        >
          {isDarkMode ? (
            <Sun className="h-5 w-5 text-white" />
          ) : (
            <Moon className="h-5 w-5 text-black" />
          )}
        </motion.button>
        <motion.button
          onClick={() => setEnableSplash(!enableSplash)}
          className={`p-3 rounded-full backdrop-blur-[40px] ${
            isDarkMode 
              ? 'bg-white/[0.08] border border-white/[0.18]' 
              : 'bg-black/[0.08] border border-black/[0.18]'
          } shadow-lg transition-all duration-300 hover:scale-110 active:scale-95`}
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.2 }}
          aria-pressed={enableSplash}
          aria-label="Toggle splash cursor"
        >
          <Sparkles className={`h-5 w-5 ${isDarkMode ? 'text-white' : 'text-black'} ${enableSplash ? '' : 'opacity-50'}`} />
        </motion.button>
      </div>

      {/* Login Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className={`text-4xl mb-2 font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>Dezprox</h1>
          <p className={`text-lg font-semibold ${isDarkMode ? 'text-green-500' : 'text-green-600'}`}>Dream | Design | Deploy</p>
          <p className={`mt-2 ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>Team Management System</p>
        </div>

        {/* Glass Card */}
        <div className={`relative backdrop-blur-[40px] ${
          isDarkMode 
            ? 'bg-white/[0.08] border border-white/[0.18]' 
            : 'bg-white/80 border border-black/[0.12]'
        } rounded-[24px] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]`}>
          {/* Welcome Text */}
          <div className="mb-6">
            <h2 className={`text-2xl mb-1 font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>Welcome Back</h2>
            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>Please enter your credentials to sign in</p>
          </div>

          <Tabs defaultValue="admin" value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Custom Segmented Control */}
            <div className={`relative backdrop-blur-md ${
              isDarkMode 
                ? 'bg-white/[0.06] border border-white/[0.12]' 
                : 'bg-black/[0.06] border border-black/[0.12]'
            } rounded-[16px] p-1.5 mb-8 shadow-inner`}>
              <div className="grid grid-cols-2 gap-2 relative z-10">
                <motion.button
                  layout
                  type="button"
                  onClick={() => setActiveTab("admin")}
                  className={`relative py-3.5 px-5 rounded-[12px] transition-all duration-300 flex items-center justify-center gap-4 ${
                    activeTab === "admin"
                      ? isDarkMode ? "text-white font-medium dark:bg-white/20  " : "text-black font-medium bg-black/20"
                      : isDarkMode ? "text-white/40  hover:text-white/70" : "text-black/40 hover:text-black/70"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Shield className={`h-4 w-4 transition-transform duration-300 ${
                    activeTab === "admin" ? "scale-110 " : "scale-100"
                  }`} />
                  <span className="text-sm">Admin</span>
                  {activeTab === "admin" && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-white 
                      dark:bg-white/20 
                      bg-black/20
                      rounded-lg -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
                <motion.button
                  layout
                  type="button"
                  onClick={() => setActiveTab("employee")}
                  className={`relative py-3.5 px-4 rounded-[12px] transition-all duration-300 flex items-center justify-center gap-2 ${
                    activeTab === "employee"
                      ? isDarkMode ? "text-white font-medium dark:bg-white/20 " : "text-black font-medium bg-black/20"
                      : isDarkMode ? "text-white/40 hover:text-white/70" : "text-black/40 hover:text-black/70"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <User className={`h-4 w-4 transition-transform duration-300 ${
                    activeTab === "employee" ? "scale-110" : "scale-100"
                  }`} />
                  <span className="text-sm">Employee</span>
                  {activeTab === "employee" && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-white bg-white/20  bg-black/20 rounded-lg -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              </div>
            </div>

            {/* Admin Login */}
            <TabsContent value="admin" className="mt-0">
              <motion.form
                onSubmit={handleAdminSubmit}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>Email</Label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className={`pl-11 h-12 backdrop-blur-md rounded-[12px] transition-all ${
                        isDarkMode 
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/40 focus:bg-white/[0.08] focus:border-white/[0.24]'
                          : 'bg-black/[0.06] border border-black/[0.12] text-black placeholder:text-black/40 focus:bg-black/[0.08] focus:border-black/[0.24]'
                      }`}
                      required
                      disabled={isAdminLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password" className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>Password</Label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                    <Input
                      id="admin-password"
                      type={showAdminPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className={`pl-11 pr-11 h-12 backdrop-blur-md rounded-[12px] transition-all ${
                        isDarkMode 
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/40 focus:bg-white/[0.08] focus:border-white/[0.24]'
                          : 'bg-black/[0.06] border border-black/[0.12] text-black placeholder:text-black/40 focus:bg-black/[0.08] focus:border-black/[0.24]'
                      }`}
                      required
                      disabled={isAdminLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-white/40 hover:text-white/70' : 'text-black/40 hover:text-black/70'}`}
                    >
                      {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className={`w-4 h-4 rounded transition-all ${
                      isDarkMode 
                        ? 'bg-white/[0.06] border border-white/[0.12]'
                        : 'bg-black/[0.06] border border-black/[0.12]'
                    } checked:bg-[#227631] checked:border-[#3FA740]`} />
                    <span className={`transition-colors ${
                      isDarkMode 
                        ? 'text-white/60 group-hover:text-white/80'
                        : 'text-black/60 group-hover:text-black/80'
                    }`}>Remember me</span>
                  </label>
                 
                </div>

                <Button
                  type="submit"
                  disabled={isAdminLoading}
                  className="w-full h-12 rounded-[16px] text-white border-0 transition-all duration-300 active:scale-95 hover:scale-[1.02] relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(180deg, #227631 0%, #3FA740 100%)',
                    boxShadow: '0 8px 32px rgba(34, 118, 49, 0.4), 0 0 0 1px rgba(63, 167, 64, 0.2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isAdminLoading) {
                      e.currentTarget.style.boxShadow = '0 8px 48px rgba(34, 118, 49, 0.7), 0 0 60px rgba(63, 167, 64, 0.5), 0 0 0 1px rgba(63, 167, 64, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(34, 118, 49, 0.4), 0 0 0 1px rgba(63, 167, 64, 0.2)';
                  }}
                >
                  <span className="relative z-10">
                    {isAdminLoading ? "Signing in..." : "Sign in as Admin"}
                  </span>
                  {!isAdminLoading && (
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      style={{ mixBlendMode: 'overlay' }}
                    />
                  )}
                </Button>
              </motion.form>
            </TabsContent>

            {/* Employee Login */}
            <TabsContent value="employee" className="mt-0">
              <motion.form
                onSubmit={handleEmployeeSubmit}
                className="space-y-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="employee-email" className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>Email</Label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                    <Input
                      id="employee-email"
                      type="email"
                      placeholder="employee@example.com"
                      value={employeeEmail}
                      onChange={(e) => setEmployeeEmail(e.target.value)}
                      className={`pl-11 h-12 backdrop-blur-md rounded-[12px] transition-all ${
                        isDarkMode 
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/40 focus:bg-white/[0.08] focus:border-white/[0.24]'
                          : 'bg-black/[0.06] border border-black/[0.12] text-black placeholder:text-black/40 focus:bg-black/[0.08] focus:border-black/[0.24]'
                      }`}
                      required
                      disabled={isEmployeeLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee-password" className={`text-sm ${isDarkMode ? 'text-white/80' : 'text-black/80'}`}>Password</Label>
                  <div className="relative">
                    <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
                    <Input
                      id="employee-password"
                      type={showEmployeePassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={employeePassword}
                      onChange={(e) => setEmployeePassword(e.target.value)}
                      className={`pl-11 pr-11 h-12 backdrop-blur-md rounded-[12px] transition-all ${
                        isDarkMode 
                          ? 'bg-white/[0.06] border border-white/[0.12] text-white placeholder:text-white/40 focus:bg-white/[0.08] focus:border-white/[0.24]'
                          : 'bg-black/[0.06] border border-black/[0.12] text-black placeholder:text-black/40 focus:bg-black/[0.08] focus:border-black/[0.24]'
                      }`}
                      required
                      disabled={isEmployeeLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                      className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-white/40 hover:text-white/70' : 'text-black/40 hover:text-black/70'}`}
                    >
                      {showEmployeePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className={`w-4 h-4 rounded transition-all ${
                      isDarkMode 
                        ? 'bg-white/[0.06] border border-white/[0.12]'
                        : 'bg-black/[0.06] border border-black/[0.12]'
                    } checked:bg-blue-600 checked:border-blue-500`} />
                    <span className={`transition-colors ${
                      isDarkMode 
                        ? 'text-white/60 group-hover:text-white/80'
                        : 'text-black/60 group-hover:text-black/80'
                    }`}>Remember me</span>
                  </label>
               
                </div>

                <Button
                  type="submit"
                  disabled={isEmployeeLoading}
                  className="w-full h-12 rounded-[16px] text-white border-0 transition-all duration-200 active:scale-95 hover:scale-[1.02] relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)',
                    boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(29, 78, 216, 0.2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isEmployeeLoading) {
                      e.currentTarget.style.boxShadow = '0 8px 48px rgba(37, 99, 235, 0.7), 0 0 60px rgba(29, 78, 216, 0.5), 0 0 0 1px rgba(29, 78, 216, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(29, 78, 216, 0.2)';
                  }}
                >
                  <span className="relative z-10">
                    {isEmployeeLoading ? "Signing in..." : "Sign in as Employee"}
                  </span>
                  {!isEmployeeLoading && (
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      style={{ mixBlendMode: 'overlay' }}
                    />
                  )}
                </Button>
              </motion.form>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className={`mt-6 text-center text-sm ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
            <p>© 2025 Dezprox. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
