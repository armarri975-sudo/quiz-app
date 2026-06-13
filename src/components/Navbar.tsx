import React from "react";
import { GraduationCap, ShieldCheck, LogOut, LogIn, Award } from "lucide-react";
import { User } from "firebase/auth";

interface NavbarProps {
  currentView: "quiz" | "admin";
  onViewChange: (view: "quiz" | "admin") => void;
  user: User | null;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({
  currentView,
  onViewChange,
  user,
  isAdmin,
  onLogin,
  onLogout,
}: NavbarProps) {
  return (
    <header id="app-header" className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo Section */}
        <div 
          id="logo-section"
          className="flex cursor-pointer items-center space-x-2" 
          onClick={() => onViewChange("quiz")}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-100">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-zinc-900">
            ProQuiz
          </span>
        </div>

        {/* Navigation Actions */}
        <div id="nav-actions" className="flex items-center space-x-4">
          <button
            id="nav-btn-quiz"
            onClick={() => onViewChange("quiz")}
            className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              currentView === "quiz"
                ? "bg-orange-50 text-orange-600 font-semibold"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Play Quiz</span>
          </button>

          <button
            id="nav-btn-admin"
            onClick={() => onViewChange("admin")}
            className={`flex items-center space-x-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              currentView === "admin"
                ? "bg-indigo-50 text-indigo-600 font-semibold"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Admin Panel</span>
          </button>

          {/* User Auth Controls */}
          {user ? (
            <div id="user-panel" className="flex items-center space-x-3 border-l border-zinc-200 pl-4">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-xs font-semibold text-zinc-800">
                  {user.displayName || "User"}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {isAdmin ? "Administrator" : "Viewer"}
                </span>
              </div>
              
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt={user.displayName || "Avatar"}
                  className="h-8 w-8 rounded-full border border-zinc-200"
                />
              ) : (
                <div id="avatar-fallback" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                  {(user.email || "U").charAt(0).toUpperCase()}
                </div>
              )}

              <button
                id="btn-signout"
                onClick={onLogout}
                title="Sign Out"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              id="btn-signin"
              onClick={onLogin}
              className="flex items-center space-x-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800"
            >
              <LogIn className="h-4 w-4" />
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
