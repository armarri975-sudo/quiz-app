import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Trash2, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Send,
  UserCheck,
  LogOut,
  HelpCircle,
  Database,
  BookOpen,
  FolderPlus,
  Plus,
  Tag,
  Award
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  orderBy, 
  query, 
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { User } from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { Question, Subject, QuizScore } from "../types";

interface AdminPanelProps {
  user: User | null;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export default function AdminPanel({ user, isAdmin, onLogin, onLogout }: AdminPanelProps) {
  // Navigation Tabs for Admin
  const [activeTab, setActiveTab] = useState<"questions" | "subjects" | "scores">("questions");

  // Scores state
  const [scoresList, setScoresList] = useState<QuizScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoresSearch, setScoresSearch] = useState("");

  // Form States for Questions
  const [text, setText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<"A" | "B" | "C" | "D">("A");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [publishToLobby, setPublishToLobby] = useState(false);

  // Form States for Subjects
  const [newSubjectName, setNewSubjectName] = useState("");
  
  // UI States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingSubject, setSubmittingSubject] = useState(false);
  
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Custom confirmation states to work perfectly inside restricted sandboxed iframe where window.confirm is blocked
  const [confirmDeleteQuestionId, setConfirmDeleteQuestionId] = useState<string | null>(null);
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);

  // Mobile child display modes to toggle list vs creation panel
  const [questionSubMode, setQuestionSubMode] = useState<"list" | "create">("list");
  const [subjectSubMode, setSubjectSubMode] = useState<"list" | "create">("list");

  // Fetch Subjects
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const q = query(collection(db, "subjects"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedSubjects: Subject[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedSubjects.push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
        } as Subject);
      });
      setSubjects(fetchedSubjects);
      
      // Auto-set selected subject if empty
      if (fetchedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(fetchedSubjects[0].id);
      }
    } catch (err) {
      console.error("Error reading subjects:", err);
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch Questions
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedQuestions: Question[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedQuestions.push({
          id: doc.id,
          text: data.text,
          options: data.options,
          correctAnswer: data.correctAnswer,
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          isPublished: data.isPublished !== false,
        } as Question);
      });
      setQuestions(fetchedQuestions);
    } catch (err) {
      console.error("Error reading questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchScores = async () => {
    if (!user || !isAdmin) return;
    setLoadingScores(true);
    try {
      const q = query(collection(db, "scores"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedScores: QuizScore[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedScores.push({
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
      setScoresList(fetchedScores);
    } catch (err) {
      console.error("Error reading student scores ledger:", err);
    } finally {
      setLoadingScores(false);
    }
  };

  const handleDeleteScore = async (scoreId: string) => {
    if (!user || !isAdmin) return;
    try {
      await deleteDoc(doc(db, "scores", scoreId));
      setScoresList(prev => prev.filter(s => s.id !== scoreId));
      setMsg({ type: "success", text: "Student score record successfully deleted." });
    } catch (err) {
      console.error("Error deleting student score:", err);
      setMsg({ type: "error", text: "Failed to delete student score: " + String(err) });
    }
  };

  const loadAllData = async () => {
    await fetchSubjects();
    await fetchQuestions();
    await fetchScores();
  };

  // Fetch on mount / when auth state ready
  useEffect(() => {
    if (user && isAdmin) {
      loadAllData();
    }
  }, [user, isAdmin]);

  // Handle template subjects trigger to make setup extremely fast
  const handlePrepopulateSubjects = async () => {
    if (!user || !isAdmin) return;
    const defaults = ["Science", "General Knowledge", "Computer Science", "Mathematics", "English"];
    setSubmittingSubject(true);
    try {
      for (const def of defaults) {
        // Skip if subject name already exists
        if (subjects.some(s => s.name.toLowerCase() === def.toLowerCase())) continue;
        await addDoc(collection(db, "subjects"), {
          name: def,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
      }
      setMsg({ type: "success", text: "Successfully prepopulated default academic subjects!" });
      await fetchSubjects();
    } catch (err) {
      setMsg({ type: "error", text: "Failed to prepopulate: " + String(err) });
    } finally {
      setSubmittingSubject(false);
    }
  };

  // Create Subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      setMsg({ type: "error", text: "Unauthorized: Only administrators can add subjects." });
      return;
    }

    if (!newSubjectName.trim()) {
      setMsg({ type: "error", text: "Subject name cannot be empty." });
      return;
    }

    // Check if name already exists to prevent duplicate subjects
    const exists = subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase());
    if (exists) {
      setMsg({ type: "error", text: `Subject "${newSubjectName.trim()}" already exists.` });
      return;
    }

    setSubmittingSubject(true);
    setMsg(null);

    const pathString = "subjects";
    try {
      const docRef = await addDoc(collection(db, pathString), {
        name: newSubjectName.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      setMsg({ type: "success", text: `Subject "${newSubjectName.trim()}" successfully created!` });
      setNewSubjectName("");
      await fetchSubjects();
      
      // Auto-select the newly created subject for rapid question addition
      setSelectedSubjectId(docRef.id);
      setActiveTab("questions"); // Switch tab automatically to build question
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, pathString);
      } catch (wrappedError) {
        setMsg({ 
          type: "error", 
          text: wrappedError instanceof Error ? wrappedError.message : "Failed to create subject." 
        });
      }
    } finally {
      setSubmittingSubject(false);
    }
  };

  // Delete Subject
  const handleDeleteSubject = async (id: string, name: string) => {
    const pathString = `subjects/${id}`;
    try {
      await deleteDoc(doc(db, "subjects", id));
      setSubjects(prev => prev.filter(s => s.id !== id));
      if (selectedSubjectId === id) {
        setSelectedSubjectId("");
      }
      setMsg({ type: "success", text: `Subject "${name}" deleted.` });
      setConfirmDeleteSubjectId(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, pathString);
      } catch (wrappedError) {
        setMsg({ 
          type: "error", 
          text: wrappedError instanceof Error ? wrappedError.message : "Failed to delete subject." 
        });
      }
    }
  };

  // Toggle Publication status for Question
  const togglePublishQuestion = async (id: string, currentStatus: boolean) => {
    if (!user || !isAdmin) return;
    const pathString = `questions/${id}`;
    try {
      await updateDoc(doc(db, "questions", id), {
        isPublished: !currentStatus
      });
      setMsg({ type: "success", text: `Question status updated to ${!currentStatus ? "Published" : "Draft"}` });
      await fetchQuestions();
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, pathString);
      } catch (wrappedError) {
        setMsg({ 
          type: "error", 
          text: wrappedError instanceof Error ? wrappedError.message : "Failed to update question status." 
        });
      }
    }
  };

  // Create Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      setMsg({ type: "error", text: "Unauthorized: Only administrators can add questions." });
      return;
    }

    const activeSubject = subjects.find(s => s.id === selectedSubjectId);
    if (!activeSubject) {
      setMsg({ type: "error", text: "Please create or select a valid Subject for this question." });
      return;
    }

    if (!text.trim() || !optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setMsg({ type: "error", text: "All multiple-choice options and prompt text must be filled." });
      return;
    }

    setSubmittingQuestion(true);
    setMsg(null);

    const newQuestionPayload = {
      text: text.trim(),
      options: {
        A: optionA.trim(),
        B: optionB.trim(),
        C: optionC.trim(),
        D: optionD.trim(),
      },
      correctAnswer,
      subjectId: activeSubject.id,
      subjectName: activeSubject.name,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      isPublished: publishToLobby,
    };

    const pathString = "questions";
    try {
      await addDoc(collection(db, pathString), newQuestionPayload);
      
      // Clear question form
      setText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setCorrectAnswer("A");
      setPublishToLobby(false);
      
      setMsg({ type: "success", text: "Question successfully added under subject: " + activeSubject.name });
      await fetchQuestions();
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, pathString);
      } catch (wrappedError) {
        setMsg({ 
          type: "error", 
          text: wrappedError instanceof Error ? wrappedError.message : "Failed to save question." 
        });
      }
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    const pathString = `questions/${id}`;
    try {
      await deleteDoc(doc(db, "questions", id));
      setQuestions(prev => prev.filter(q => q.id !== id));
      setMsg({ type: "success", text: "Question deleted successfully." });
      setConfirmDeleteQuestionId(null);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, pathString);
      } catch (wrappedError) {
        setMsg({ 
          type: "error", 
          text: wrappedError instanceof Error ? wrappedError.message : "Failed to delete question." 
        });
      }
    }
  };

  // Auto-expire success/error toast
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 8500);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  // LOGIN SCREEN
  if (!user) {
    return (
      <div id="unauthenticated-admin-panel" className="mx-auto max-w-lg px-4 py-16 text-center animate-fade-in">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-6">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-zinc-900 tracking-tight">Admin Authentication</h2>
          <p className="mt-2 text-zinc-600 text-sm leading-relaxed">
            Welcome, Educator! Please sign in with Google to configure your custom workspace, add subjects, and build quiz material.
          </p>
          
          <button
            id="admin-login-btn-popup"
            onClick={onLogin}
            className="mt-8 flex w-full items-center justify-center space-x-3 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:shadow-indigo-100 transition-all cursor-pointer"
          >
            <Database className="h-5 w-5" />
            <span>Sign In with Google</span>
          </button>

          <p className="mt-4 text-xs text-zinc-400">
            Designated administrator accounts can add, edit, or configure quiz material.
          </p>
        </div>
      </div>
    );
  }

  // ACCESS DENIED SCREEN
  if (user && !isAdmin) {
    return (
      <div id="unauthorized-admin-panel" className="mx-auto max-w-lg px-4 py-16 text-center animate-fade-in">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-6">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-zinc-900 tracking-tight">Access Denied</h2>
          <p className="mt-2 text-zinc-600 text-sm leading-relaxed">
            You are signed in as <strong className="font-semibold text-zinc-900">{user.email}</strong>, but this profile does not possess necessary educator privilege roles.
          </p>
          
          <div className="mt-6 flex flex-col space-y-3">
            <button
              id="switch-admin-btn"
              onClick={onLogin}
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-all cursor-pointer"
            >
              <span>Switch Google Account</span>
            </button>
            <button
              id="logout-unauth-btn"
              onClick={onLogout}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          </div>
          
          <p className="mt-6 text-xs text-zinc-400">
            For setup queries, please ensure your email is declared in the Cloud Firestore admin catalog checklist.
          </p>
        </div>
      </div>
    );
  }

  // MAIN ADMIN INTERFACE
  return (
    <div id="authorized-admin-panel" className="space-y-5 animate-fade-in text-zinc-900 pb-16">
      
      {/* Compact Mobile Header Card */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-zinc-950 p-4 shadow-md text-white border border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase mb-1">
              <UserCheck className="h-2.5 w-2.5 mr-1" />
              <span>Educator Control</span>
            </div>
            <h1 className="font-display text-lg font-black tracking-tight leading-tight">Teacher Console</h1>
            <p className="text-[10px] text-slate-300 mt-0.5">Build customizable challenges for students.</p>
          </div>
          
          <button
            id="btn-repropulate"
            type="button"
            disabled={submittingSubject}
            onClick={handlePrepopulateSubjects}
            className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold px-3 py-1.5 rounded-lg text-white transition-all cursor-pointer disabled:opacity-50 shadow-sm shadow-indigo-900/50"
          >
            Load Presets
          </button>
        </div>
      </div>

      {msg && (
        <div id="admin-status-toast" className={`flex items-start space-x-2.5 rounded-xl p-3 border animate-fade-in ${
          msg.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium text-xs" 
            : "bg-rose-50 border-rose-200 text-rose-800 font-medium text-xs"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 mt-0.5" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />}
          <div className="text-xs">
            <span className="leading-snug block font-bold">{msg.text}</span>
          </div>
        </div>
      )}

      {/* Internal Navigation Tabs (Manage Questions vs Manage Subjects vs Student Scores) */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            id="tab-btn-questions"
            onClick={() => {
              setActiveTab("questions");
              setQuestionSubMode("list");
            }}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-display text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "questions"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Questions ({questions.length})</span>
          </button>

          <button
            id="tab-btn-subjects"
            onClick={() => {
              setActiveTab("subjects");
              setSubjectSubMode("list");
            }}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-display text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "subjects"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Subjects ({subjects.length})</span>
          </button>

          <button
            id="tab-btn-scores-admin"
            onClick={() => {
              setActiveTab("scores");
              fetchScores();
            }}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-display text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              activeTab === "scores"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Student Scores ({scoresList.length})</span>
          </button>
        </nav>
      </div>

      {/* ======= TAB CONTENT: QUESTIONS ======= */}
      {activeTab === "questions" && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Touch-Friendly Segment Pill Swapper */}
          <div className="flex bg-zinc-150 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setQuestionSubMode("list")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                questionSubMode === "list" 
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200" 
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Question Bank ({questions.length})
            </button>
            <button
              onClick={() => setQuestionSubMode("create")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                questionSubMode === "create" 
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200" 
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              ＋ Add Question
            </button>
          </div>

          {/* SUB-VIEW A: ALL QUESTIONS LIST */}
          {questionSubMode === "list" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Active Materials</h3>
                <button
                  id="refresh-questions-btn"
                  onClick={fetchQuestions}
                  className="text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Sync List
                </button>
              </div>

              {loadingQuestions && questions.length === 0 ? (
                <div id="questions-skeleton" className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-zinc-200">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-[10px] text-zinc-500 font-medium">Fetching question bank...</p>
                </div>
              ) : questions.length === 0 ? (
                <div id="no-questions-placeholder" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-zinc-500">
                  <HelpCircle className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
                  <h4 className="font-bold text-zinc-850 text-xs">No questions loaded</h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5 max-w-xs mx-auto">
                    Draft custom queries to build customized playboards for students!
                  </p>
                  <button 
                    onClick={() => setQuestionSubMode("create")}
                    className="mt-3 inline-flex items-center space-x-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    <span>Create One Now</span>
                  </button>
                </div>
              ) : (
                <div id="questions-list-root" className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      id={`q-card-${question.id}`}
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all relative"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-[9px] font-bold text-zinc-500">
                            #{questions.length - index}
                          </span>
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 border border-indigo-100 text-indigo-700">
                            {question.subjectName}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePublishQuestion(question.id, question.isPublished !== false)}
                            className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border transition-all cursor-pointer ${
                              question.isPublished !== false
                                ? "bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100"
                                : "bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100"
                            }`}
                            title="Click to toggle student visibility"
                          >
                            <span>{question.isPublished !== false ? "● Published" : "○ Draft (Hidden)"}</span>
                          </button>
                        </div>
                        
                        {confirmDeleteQuestionId === question.id ? (
                          <div className="flex items-center space-x-1 animate-fade-in bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                            <span className="text-[9px] font-bold text-rose-700 mr-1">Delete?</span>
                            <button
                              id={`confirm-delete-btn-${question.id}`}
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              id={`cancel-delete-btn-${question.id}`}
                              onClick={() => setConfirmDeleteQuestionId(null)}
                              className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`delete-btn-${question.id}`}
                            onClick={() => setConfirmDeleteQuestionId(question.id)}
                            className="text-zinc-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                            title="Delete Question"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs font-bold text-zinc-950 mt-2.5 pr-2 leading-snug">
                        {question.text}
                      </p>

                      {/* Options stack list */}
                      <div className="space-y-1 mt-3">
                        {(["A", "B", "C", "D"] as const).map((key) => {
                          const isCorrect = question.correctAnswer === key;
                          return (
                            <div
                              key={key}
                              className={`flex items-start text-[11px] rounded-lg p-2 border ${
                                isCorrect
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-950 font-semibold"
                                  : "bg-zinc-50 border-zinc-150 text-zinc-700"
                              }`}
                            >
                              <span className={`inline-flex px-1 font-bold rounded mr-2 shrink-0 ${
                                isCorrect ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
                              }`}>
                                {key}
                              </span>
                              <span className="leading-snug break-words pr-1">
                                {question.options[key]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW B: ADD QUESTION FORM */}
          {questionSubMode === "create" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm animate-fade-in">
              <div className="flex items-center space-x-1.5 mb-4 pb-2 border-b border-zinc-100">
                <PlusCircle className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="font-display text-sm font-bold text-zinc-900">Add New Question</h3>
              </div>

              {subjects.length === 0 ? (
                <div id="no-subject-warning-prompt" className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-orange-800 text-xs text-center space-y-2">
                  <FolderPlus className="h-6 w-6 text-orange-600 mx-auto" />
                  <p className="font-bold text-xs">No Subjects Detected</p>
                  <p className="leading-relaxed text-[11px]">
                    Create at least one subject category before building quiz questions.
                  </p>
                  <button
                    id="trigger-subjects-tab-btn"
                    onClick={() => {
                      setActiveTab("subjects");
                      setSubjectSubMode("create");
                    }}
                    className="inline-flex items-center space-x-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-all cursor-pointer"
                  >
                    <span>Create a Subject</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  handleAddQuestion(e);
                  setQuestionSubMode("list"); // Return to list after saving
                }} id="add-question-form" className="space-y-4">
                  
                  {/* Subject Selector */}
                  <div id="field-group-subject">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Subject Category
                    </label>
                    <select
                      id="select-question-subject"
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-950 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                      required
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question Text */}
                  <div id="field-group-text">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Question Text
                    </label>
                    <textarea
                      id="input-text"
                      rows={2}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="e.g. What gas is most abundant in Earth's atmosphere?"
                      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-950 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                      required
                    />
                  </div>

                  {/* Options */}
                  <div id="field-group-options" className="space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Choice Keys (A to D)
                    </label>
                    
                    <div className="space-y-2">
                      {[
                        { key: "A" as const, val: optionA, set: setOptionA },
                        { key: "B" as const, val: optionB, set: setOptionB },
                        { key: "C" as const, val: optionC, set: setOptionC },
                        { key: "D" as const, val: optionD, set: setOptionD },
                      ].map((item) => (
                        <div key={item.key} className="relative rounded-xl">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span className="text-[10px] font-extrabold text-indigo-400">{item.key}</span>
                          </div>
                          <input
                            id={`input-option-${item.key.toLowerCase()}`}
                            type="text"
                            value={item.val}
                            onChange={(e) => item.set(e.target.value)}
                            placeholder={`Option ${item.key}`}
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-1.5 pl-7 pr-3 text-xs text-zinc-950 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Designated Correct Answer */}
                  <div id="field-group-correct">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 text-center">
                      Identify Correct Key
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["A", "B", "C", "D"] as const).map((letter) => (
                        <button
                          key={letter}
                          id={`correct-ans-choice-${letter}`}
                          type="button"
                          onClick={() => setCorrectAnswer(letter)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            correctAnswer === letter
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Publish Status Checkbox */}
                  <div id="field-group-publish" className="flex items-start space-x-2.5 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                    <input
                      id="checkbox-publish-lobby"
                      type="checkbox"
                      checked={publishToLobby}
                      onChange={(e) => setPublishToLobby(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-zinc-350 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                    <div className="text-left select-none">
                      <label htmlFor="checkbox-publish-lobby" className="block text-xs font-bold text-zinc-800 cursor-pointer">
                        Publish to Student Quiz Arena
                      </label>
                      <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                        Keep unchecked to save as Draft (hidden from students). Students cannot play draft questions.
                      </p>
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuestionSubMode("list")}
                      className="flex-1 py-2.5 bg-zinc-150 hover:bg-zinc-250 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      Cancel
                    </button>
                    <button
                      id="submit-question-btn"
                      type="submit"
                      disabled={submittingQuestion}
                      className="flex-1 flex items-center justify-center space-x-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white shadow-md disabled:bg-zinc-200 disabled:text-zinc-400 transition-all cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{submittingQuestion ? "Saving..." : "Publish"}</span>
                    </button>
                  </div>

                </form>
              )}
            </div>
          )}

        </div>
      )}

      {/* ======= TAB CONTENT: SUBJECTS ======= */}
      {activeTab === "subjects" && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Segment Selector for Subjects */}
          <div className="flex bg-zinc-150 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => setSubjectSubMode("list")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                subjectSubMode === "list" 
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200" 
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Academic Subjects ({subjects.length})
            </button>
            <button
              onClick={() => setSubjectSubMode("create")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                subjectSubMode === "create" 
                  ? "bg-white text-indigo-600 shadow-sm border border-zinc-200" 
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              ＋ New Subject
            </button>
          </div>

          {/* SUB-VIEW A: SUBJECTS LIST */}
          {subjectSubMode === "list" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">Categories</h3>
                <button
                  id="refresh-subjects-btn"
                  onClick={fetchSubjects}
                  className="text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Sync
                </button>
              </div>

              {loadingSubjects && subjects.length === 0 ? (
                <div id="subjects-skeleton" className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-zinc-200">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-[10px] text-zinc-500 font-medium">Fetching active subjects...</p>
                </div>
              ) : subjects.length === 0 ? (
                <div id="no-subjects-placeholder" className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-zinc-500">
                  <FolderPlus className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
                  <h4 className="font-bold text-zinc-850 text-xs">No subjects yet</h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5 max-w-xs mx-auto">
                    Create subject groups to link custom question lists.
                  </p>
                  <button 
                    onClick={() => setSubjectSubMode("create")}
                    className="mt-3 inline-flex items-center space-x-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    <span>Add One Now</span>
                  </button>
                </div>
              ) : (
                <div id="subjects-list-root" className="grid grid-cols-1 gap-2.5">
                  {subjects.map((sub) => {
                    const qCount = questions.filter(q => q.subjectId === sub.id).length;
                    return (
                      <div
                        key={sub.id}
                        id={`subject-card-${sub.id}`}
                        className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm hover:shadow-md transition-all flex justify-between items-center"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-extrabold text-zinc-900 flex items-center">
                            <Tag className="h-3 w-3 text-zinc-400 mr-1.5 shrink-0" />
                            {sub.name}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-medium font-mono pl-4.5">
                            {qCount} {qCount === 1 ? "question" : "questions"} active
                          </p>
                        </div>

                        {confirmDeleteSubjectId === sub.id ? (
                          <div className="flex items-center space-x-1 animate-fade-in bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                            <span className="text-[9px] font-bold text-rose-700">Delete {qCount > 0 ? `+${qCount}q` : ""}?</span>
                            <button
                              id={`confirm-delete-sub-${sub.id}`}
                              onClick={() => handleDeleteSubject(sub.id, sub.name)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all"
                            >
                              Yes
                            </button>
                            <button
                              id={`cancel-delete-sub-${sub.id}`}
                              onClick={() => setConfirmDeleteSubjectId(null)}
                              className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-all"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`delete-subject-${sub.id}`}
                            onClick={() => setConfirmDeleteSubjectId(sub.id)}
                            className="text-zinc-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                            title="Delete Subject"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW B: CREATE SUBJECT FORM */}
          {subjectSubMode === "create" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm animate-fade-in">
              <div className="flex items-center space-x-1.5 mb-4 pb-2 border-b border-zinc-100">
                <FolderPlus className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="font-display text-sm font-bold text-zinc-900">Create Subject</h3>
              </div>

              <form onSubmit={(e) => {
                handleAddSubject(e);
                setSubjectSubMode("list"); // Return to list view
              }} id="create-subject-form" className="space-y-4">
                <div id="field-group-subname">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Subject Title
                  </label>
                  <input
                    id="input-subject-name"
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="e.g. Physics, Chemistry, Tech-Vibes"
                    className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-950 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    required
                  />
                </div>

                <div className="flex space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubjectSubMode("list")}
                    className="flex-1 py-2 bg-zinc-150 hover:bg-zinc-250 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-subject-btn"
                    type="submit"
                    disabled={submittingSubject}
                    className="flex-1 flex items-center justify-center space-x-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{submittingSubject ? "Saving..." : "Create"}</span>
                  </button>
                </div>
              </form>

              <div className="border-t border-zinc-100 mt-4 pt-4 text-[10px] text-zinc-500 leading-relaxed space-y-1">
                <span className="font-bold text-zinc-700 block uppercase tracking-wider">Educational Notes:</span>
                <p>Subjects partition dynamic question folders. After subject compilation, students can filter and begin topic-specific tests on demand.</p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ======= TAB CONTENT: STUDENT SCORES ======= */}
      {activeTab === "scores" && (
        <div className="space-y-4 animate-fade-in text-zinc-900">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-bold flex items-center gap-1.5 text-zinc-900">
                  <Database className="h-4.5 w-4.5 text-indigo-600" />
                  Student Performance Records
                </h3>
                <p className="text-[10px] text-zinc-505">Track, review, and manage completed mock tests logged by students.</p>
              </div>
              <button
                onClick={fetchScores}
                className="self-start sm:self-center text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-all"
              >
                Sync Records
              </button>
            </div>

            <div className="pt-2">
              <input
                type="text"
                placeholder="Search report logs by student or subject..."
                value={scoresSearch}
                onChange={(e) => setScoresSearch(e.target.value)}
                className="w-full text-xs bg-zinc-50 border border-zinc-250 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-2.5 outline-none transition-all"
              />
            </div>

            {loadingScores && scoresList.length === 0 ? (
              <div className="py-12 text-center animate-pulse space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-[10px] text-zinc-500">Querying attempts database...</p>
              </div>
            ) : scoresList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                <Award className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs font-bold text-zinc-800">No score reports available</p>
                <p className="text-[9px] text-zinc-400 mt-1 max-w-xs mx-auto">After students log in and play quiz modules, their attempts will be registered here instantly.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-150">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Completed At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {scoresList
                      .filter(s => 
                        s.studentName.toLowerCase().includes(scoresSearch.toLowerCase()) || 
                        (s.studentEmail && s.studentEmail.toLowerCase().includes(scoresSearch.toLowerCase())) ||
                        s.subjectName.toLowerCase().includes(scoresSearch.toLowerCase())
                      )
                      .map((sc) => {
                        let badgeColor = "bg-rose-50 text-rose-700 border-rose-100";
                        if (sc.percentageScore >= 80) {
                          badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        } else if (sc.percentageScore >= 50) {
                          badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                        }

                        let testDate = "Date Unknown";
                        if (sc.createdAt) {
                          const dateObj = sc.createdAt.toDate ? sc.createdAt.toDate() : new Date(sc.createdAt);
                          testDate = dateObj.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          });
                        }

                        return (
                          <tr key={sc.id} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-zinc-900 block">{sc.studentName}</span>
                              <span className="text-[10px] text-zinc-400 block">{sc.studentEmail || "Anonymous"}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-zinc-700">{sc.subjectName}</td>
                            <td className="py-3 px-4 font-mono font-bold text-zinc-800">
                              {sc.score} / {sc.totalQuestions}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                {sc.percentageScore}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-500 font-medium text-[10px]">{testDate}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteScore(sc.id)}
                                className="text-zinc-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                                title="Delete Log"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
