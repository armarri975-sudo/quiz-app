import React, { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";
import QuizPlay from "./components/QuizPlay";
import AdminPanel from "./components/AdminPanel";
import { 
  Award, 
  ShieldCheck, 
  LogOut, 
  LogIn, 
  Sparkles, 
  Layers,
  Database,
  History,
  Mail,
  Lock,
  User as UserIcon,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Trophy,
  CheckCircle,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QuizScore } from "./types";

export default function App() {
  // Navigation Tabs for Logged-In users
  const [activeTab, setActiveTab] = useState<"quiz" | "scores" | "admin">("quiz");
  
  // Auth states
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Authentication Card forms states
  const [authAction, setAuthAction] = useState<"student-login" | "student-signup" | "teacher-login">("student-login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentName, setStudentName] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Personal Student Scores tracking
  const [studentScores, setStudentScores] = useState<QuizScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  // Monitors authentication changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Evaluate administrative privilege roles database-side or local check
        if (currentUser.email === "armarri975@gmail.com") {
          setIsAdmin(true);
        } else {
          try {
            const adminDocRef = doc(db, "admins", currentUser.uid);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists()) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (err) {
            console.warn("Verify catalog administrator failed:", err);
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync Student Score list
  const fetchStudentScores = async () => {
    if (!user) return;
    setLoadingScores(true);
    try {
      const q = query(
        collection(db, "scores"),
        where("studentId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: QuizScore[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName,
          studentEmail: data.studentEmail,
          subjectName: data.subjectName,
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentageScore: data.percentageScore,
          createdAt: data.createdAt,
        } as QuizScore);
      });
      setStudentScores(list);
    } catch (err) {
      console.error("Failed to query student scores list:", err);
    } finally {
      setLoadingScores(false);
    }
  };

  // Fetch scores on login or tab switch
  useEffect(() => {
    if (user && activeTab === "scores") {
      fetchStudentScores();
    }
  }, [user, activeTab]);

  // Google Login popup
  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    setSubmittingAuth(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Authentication error:", err);
      setAuthError(err.message || "Failed to sign in with Google.");
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Custom password authorization
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!email.trim() || !password.trim()) {
      setAuthError("Please fill out all required fields.");
      return;
    }

    setSubmittingAuth(true);

    try {
      if (authAction === "student-signup") {
        if (!studentName.trim()) {
          setAuthError("Please enter your name.");
          setSubmittingAuth(false);
          return;
        }
        // Create user
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
        // Set display name in auth profile
        await updateProfile(credential.user, {
          displayName: studentName.trim()
        });
        setAuthSuccess("A student account has been registered successfully!");
        setAuthAction("student-login");
        // Clear password/name fields
        setPassword("");
        setStudentName("");
      } else if (authAction === "student-login" || authAction === "teacher-login") {
        await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      }
    } catch (err: any) {
      console.error("Email Authorization error:", err);
      let customErr = err.message;
      if (err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        customErr = "Invalid email identity or password.";
      } else if (err.code === "auth/invalid-email") {
        customErr = "The email address formatting is invalid.";
      } else if (err.code === "auth/weak-password") {
        customErr = "Password must be at least 6 characters in length.";
      } else if (err.code === "auth/email-already-in-use") {
        customErr = "This email is already linked with another user account.";
      }
      setAuthError(customErr);
    } finally {
      setSubmittingAuth(false);
    }
  };

  // Clear states when toggle tabs
  const handleToggleTab = (tab: "student-login" | "student-signup" | "teacher-login") => {
    setAuthAction(tab);
    setAuthError(null);
    setAuthSuccess(null);
    setEmail("");
    setPassword("");
    setStudentName("");
  };

  // Sign out helper
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab("quiz");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (loadingAuth) {
    return (
      <div id="loading-auth-gateway" className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-900">
        <div className="text-center space-y-4">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"
          />
          <div>
            <h2 className="text-sm font-bold font-display uppercase tracking-wider text-zinc-700">Synchronizing Session</h2>
            <p className="text-xs text-zinc-400 mt-1">Acquiring authorization ticket...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="full-app-root" className="min-h-screen bg-zinc-50 text-zinc-900 font-sans tracking-tight flex flex-col">
      
      {/* ================= HEADER NAVIGATION ================= */}
      <header id="primary-app-header" className="sticky top-0 z-40 bg-white/95 border-b border-zinc-200/90 py-3.5 px-4 md:px-8 shadow-sm backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo and Title */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab("quiz")}>
            <div className="h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white flex shadow-sm shadow-orange-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-display text-base font-extrabold tracking-tight text-zinc-950">ProQuiz Arena</h1>
              </div>
              <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">Interactive Classroom Testing</p>
            </div>
          </div>

          {/* Logged in Actions Navbar */}
          {user ? (
            <div className="flex items-center space-x-4 md:space-x-6">
              
              {/* Tabs list */}
              <nav className="hidden md:flex items-center space-x-1 border border-zinc-200 bg-zinc-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === "quiz" 
                      ? "bg-white text-orange-600 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-850"
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Quiz Arena</span>
                </button>

                <button
                  onClick={() => setActiveTab("scores")}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === "scores" 
                      ? "bg-white text-orange-600 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-850"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>My Scores</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                      activeTab === "admin" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-zinc-500 hover:text-zinc-850"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Teacher Hub</span>
                  </button>
                )}
              </nav>

              {/* User Identity profile widget */}
              <div className="flex items-center space-x-3 pl-3 md:border-l border-zinc-200">
                <div className="text-right">
                  <p className="text-xs font-bold text-zinc-900 leading-tight">
                    {user.displayName || user.email?.split("@")[0] || "User Login"}
                  </p>
                  <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    isAdmin 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-150" 
                      : "bg-orange-50 text-orange-700 border border-orange-150"
                  }`}>
                    {isAdmin ? "Educator" : "Student"}
                  </span>
                </div>
                
                {/* Logout Button */}
                <button
                  id="navbar-signout"
                  onClick={handleLogout}
                  className="p-2 border border-zinc-200 hover:border-zinc-300 rounded-xl hover:bg-zinc-50 text-zinc-505 hover:text-rose-600 transition-all cursor-pointer"
                  title="Sign Out Account"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-505 font-bold uppercase tracking-wider hidden sm:inline">Guest Session</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          )}

        </div>
      </header>

      {/* ================= CONTENT BODY SECTION ================= */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col justify-center">
        
        {/* ================= IF USER NOT LOGGED IN ================= */}
        {!user ? (
          <div id="unauthenticated-marketing-layout" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full py-6">
            
            {/* Left Column: Greeting Banner & Information cards */}
            <div className="lg:col-span-7 space-y-6 lg:pr-6 text-zinc-900">
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-1 bg-orange-100 border border-orange-200/50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                  <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                  <span>Student & Educator Workspace</span>
                </div>
                <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-zinc-950 leading-tight">
                  Sharpen Your Mind, <br />
                  <span className="text-orange-500">Subject by Subject</span>
                </h2>
                <p className="text-zinc-650 text-sm max-w-xl leading-relaxed">
                  Welcome to ProQuiz Arena. Access tailored questionnaire sheets created by your teacher, receive real-time answer explanation cards, and view your complete performance logs safely.
                </p>
              </div>

              {/* Mini highlights list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="bg-white border border-zinc-200 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
                  <div className="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900">Tailored Materials</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">Solve challenge packs structured specifically by subject chapters.</p>
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 p-4 rounded-xl flex items-start space-x-3 shadow-sm">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-zinc-900">Track Performance</h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">Instantly save finished tests with score counts and dates.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Secure Authentication panel Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-xl flex flex-col space-y-6">
                
                {/* Segments switch triggers */}
                <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                  <button
                    onClick={() => handleToggleTab("student-login")}
                    className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      authAction === "student-login" 
                        ? "bg-white text-orange-600 shadow-sm border border-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Student Login
                  </button>
                  <button
                    onClick={() => handleToggleTab("student-signup")}
                    className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      authAction === "student-signup" 
                        ? "bg-white text-orange-600 shadow-sm border border-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Student Signup
                  </button>
                  <button
                    onClick={() => handleToggleTab("teacher-login")}
                    className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                      authAction === "teacher-login" 
                        ? "bg-white text-indigo-650 shadow-sm border border-zinc-200" 
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    Teacher Portal
                  </button>
                </div>

                {/* Status Banners */}
                {authError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start space-x-2 animate-fade-in text-xs">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
                    <span className="font-medium leading-snug">{authError}</span>
                  </div>
                )}
                
                {authSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start space-x-2 animate-fade-in text-xs">
                    <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" />
                    <span className="font-medium leading-snug">{authSuccess}</span>
                  </div>
                )}

                {/* Form layout */}
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  
                  {authAction === "student-signup" && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Student Full Name
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                        <input
                          type="text"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="e.g. Aria Khan"
                          className="w-full text-xs rounded-xl border border-zinc-255 bg-zinc-50 pl-10 pr-4 py-2.5 outline-none focus:border-orange-500 focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. name@student.com"
                        className="w-full text-xs rounded-xl border border-zinc-255 bg-zinc-50 pl-10 pr-4 py-2.5 outline-none focus:border-orange-500 focus:bg-white transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Secure Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs rounded-xl border border-zinc-255 bg-zinc-50 pl-10 pr-4 py-2.5 outline-none focus:border-orange-500 focus:bg-white transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingAuth}
                    className={`w-full flex items-center justify-center space-x-2 rounded-xl py-3 text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                      authAction === "teacher-login" 
                        ? "bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-200" 
                        : "bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-200"
                    }`}
                  >
                    <span>
                      {submittingAuth 
                        ? "Authenticating..." 
                        : authAction === "student-signup" 
                          ? "Register Account" 
                          : authAction === "teacher-login"
                            ? "Educator Access Login"
                            : "Student Playground Login"
                      }
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-zinc-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">or sign in with</span>
                  <div className="flex-grow border-t border-zinc-200"></div>
                </div>

                {/* Google SSO */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={submittingAuth}
                  className="w-full flex items-center justify-center space-x-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 py-3 text-xs font-bold text-zinc-700 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.1-.23-.19-.48-.28-.73z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Google SSO Single Sign-In</span>
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* ================= IF USER LOGGED IN ================= */
          <div id="authenticated-workspace-layout" className="w-full">
            
            {/* Mobile Tab Swapper indicator (Visible on mobile only since desktop has header links) */}
            <div className="flex md:hidden bg-zinc-150 p-1 rounded-xl border border-zinc-200 mb-6 text-xs">
              <button
                onClick={() => setActiveTab("quiz")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "quiz" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-500"
                }`}
              >
                Quiz Arena
              </button>
              <button
                onClick={() => setActiveTab("scores")}
                className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "scores" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-500"
                }`}
              >
                My Scores
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "admin" ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  Teacher Hub
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                
                {/* 1. QUIZ ARENA VIEW */}
                {activeTab === "quiz" && (
                  <div className="animate-fade-in">
                    <QuizPlay isAdmin={isAdmin} user={user} />
                  </div>
                )}

                {/* 2. STUDENT PERSONAL SCORE CARDS HISTORY */}
                {activeTab === "scores" && (
                  <div className="space-y-6 max-w-4xl mx-auto px-4 py-2 animate-fade-in text-zinc-900">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-5 gap-3">
                        <div>
                          <h2 className="font-display text-2xl font-black text-zinc-950 flex items-center gap-1.5">
                            <Clock className="h-6 w-6 text-orange-500" />
                            My Personal Performance Log
                          </h2>
                          <p className="text-xs text-zinc-500 mt-1">Review dates, correct ratios, and scorecard breakdowns of your completed quizzes.</p>
                        </div>
                        <button
                          onClick={fetchStudentScores}
                          className="self-start sm:self-center text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl transition-all border border-orange-100 cursor-pointer"
                        >
                          Sync Scorecard
                        </button>
                      </div>

                      {loadingScores && studentScores.length === 0 ? (
                        <div className="py-20 text-center animate-pulse space-y-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
                          <p className="text-xs text-zinc-500 font-semibold">Reading attempt logs...</p>
                        </div>
                      ) : studentScores.length === 0 ? (
                        <div className="py-16 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50">
                          <History className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-zinc-800">No scorecards found</p>
                          <p className="text-[10px] text-zinc-400 mt-1 max-w-xs mx-auto">You have not completed any custom quiz subjects yet. Switch to the Quiz Arena tab to begin your test.</p>
                          <button
                            onClick={() => setActiveTab("quiz")}
                            className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center space-x-1"
                          >
                            <span>Go to Quiz Arena</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {studentScores.map((scoreCard) => {
                            let percentageClass = "text-rose-600 border-rose-100 bg-rose-50";
                            if (scoreCard.percentageScore >= 80) {
                              percentageClass = "text-emerald-600 border-emerald-100 bg-emerald-50";
                            } else if (scoreCard.percentageScore >= 50) {
                              percentageClass = "text-amber-600 border-amber-100 bg-amber-50";
                            }

                            let createdDate = "Date Unknown";
                            if (scoreCard.createdAt) {
                              const dateObj = scoreCard.createdAt.toDate ? scoreCard.createdAt.toDate() : new Date(scoreCard.createdAt);
                              createdDate = dateObj.toLocaleDateString(undefined, {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              });
                            }

                            return (
                              <div
                                key={scoreCard.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-zinc-200 hover:border-zinc-300 bg-white shadow-sm hover:shadow transition-all gap-4"
                              >
                                <div className="space-y-1">
                                  <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-zinc-450 bg-zinc-100 px-2 py-0.5 rounded">
                                    Course Subject
                                  </span>
                                  <h4 className="font-bold text-base text-zinc-900 leading-tight">{scoreCard.subjectName}</h4>
                                  <div className="flex items-center space-x-2 text-[11px] text-zinc-450">
                                    <Clock className="h-3.5 w-3.5 text-zinc-450" />
                                    <span>{createdDate}</span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                  <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Attempt Ratio</p>
                                    <p className="font-mono text-zinc-800 font-bold text-sm">{scoreCard.score} / {scoreCard.totalQuestions} Correct</p>
                                  </div>

                                  <div className={`h-12 w-16 text-center rounded-xl border flex flex-col justify-center shrink-0 ${percentageClass}`}>
                                    <span className="text-sm font-black font-display font-bold block">{scoreCard.percentageScore}%</span>
                                    <span className="text-[8px] font-bold uppercase tracking-widest block opacity-75">Score</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. TEACHER DASHBOARD SECURE RE-INJECTION */}
                {activeTab === "admin" && isAdmin && (
                  <div className="animate-fade-in max-w-5xl mx-auto">
                    <AdminPanel
                      user={user}
                      isAdmin={isAdmin}
                      onLogin={handleGoogleLogin}
                      onLogout={handleLogout}
                    />
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        )}

      </main>

      {/* ================= FOOTER CREDIT LINES ================= */}
      <footer id="global-system-footer" className="bg-white border-t border-zinc-200/90 py-5 px-4 md:px-8 shrink-0 text-center text-zinc-400 text-[10px] font-medium tracking-wide">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} ProQuiz Arena. All Rights Reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Powered by</span>
            <span className="font-bold text-zinc-650">Google Firebase Secure-DB</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
