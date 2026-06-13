import React, { useState, useEffect } from "react";
import { 
  Award, 
  HelpCircle, 
  ChevronRight, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Play, 
  Info, 
  Dices,
  Trophy,
  BookOpen,
  Tag,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { collection, getDocs, query, addDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../firebase";
import { Question, Subject } from "../types";

interface QuizPlayProps {
  isAdmin?: boolean;
  user: User | null;
}

export default function QuizPlay({ isAdmin = false, user }: QuizPlayProps) {
  // Database States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz Game flow states
  const [phase, setPhase] = useState<"intro" | "active" | "results">("intro");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, "A" | "B" | "C" | "D">>({});
  
  // Feedback / score helper
  const [score, setScore] = useState(0);

  // Load subjects and questions
  const loadQuizData = async () => {
    setLoading(true);
    try {
      // 1. Fetch subjects
      const subjectsSnap = await getDocs(query(collection(db, "subjects")));
      const fetchedSubjects: Subject[] = [];
      subjectsSnap.forEach((doc) => {
        const data = doc.data();
        fetchedSubjects.push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
        } as Subject);
      });
      setSubjects(fetchedSubjects);

      // 2. Fetch questions
      const questionsSnap = await getDocs(query(collection(db, "questions")));
      const fetchedQuestions: Question[] = [];
      questionsSnap.forEach((doc) => {
        const data = doc.data();
        const isPublished = data.isPublished !== false; // defaults to true for backward compatibility
        
        // Skip unpublished/draft questions for student view
        if (!isAdmin && !isPublished) {
          return;
        }

        fetchedQuestions.push({
          id: doc.id,
          text: data.text,
          options: data.options,
          correctAnswer: data.correctAnswer,
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          isPublished: isPublished,
        } as Question);
      });
      setQuestions(fetchedQuestions);
    } catch (err) {
      console.error("Error loading quiz database:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizData();
  }, []);

  // Actions
  const startQuizForSubject = (subject: Subject | null) => {
    setSelectedSubject(subject);
    
    // Filter questions matching selected subject
    let filtered = questions;
    if (subject) {
      filtered = questions.filter(q => q.subjectId === subject.id);
    }
    
    if (filtered.length === 0) return;

    // Shuffle filtered questions for dynamic play
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setActiveQuestions(shuffled);
    
    setPhase("active");
    setCurrentIndex(0);
    setSelectedAnswers({});
    setScore(0);
  };

  const handleSelectOption = (option: "A" | "B" | "C" | "D") => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: option,
    }));
  };

  const handleNext = async () => {
    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Calculate final score
      let finalScore = 0;
      activeQuestions.forEach((q, idx) => {
        if (selectedAnswers[idx] === q.correctAnswer) {
          finalScore += 1;
        }
      });
      setScore(finalScore);
      setPhase("results");

      // Save score to database if logged in
      if (user) {
        try {
          const totalQ = activeQuestions.length;
          const percentageScore = totalQ > 0 ? Math.round((finalScore / totalQ) * 100) : 0;
          await addDoc(collection(db, "scores"), {
            studentId: user.uid,
            studentName: user.displayName || user.email?.split("@")[0] || "Student",
            studentEmail: user.email || null,
            subjectName: selectedSubject ? selectedSubject.name : "All Subjects mixed",
            score: finalScore,
            totalQuestions: totalQ,
            percentageScore: percentageScore,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Error saving student quiz score to Firestore:", err);
        }
      }
    }
  };

  const restartQuiz = async () => {
    setPhase("intro");
    setSelectedSubject(null);
    setActiveQuestions([]);
    await loadQuizData();
  };

  // Score description generator
  const getScoreDescription = (percent: number) => {
    if (percent === 100) return { title: "Perfect Score!", body: "Outstanding! You are an absolute Grandmaster in this subject!", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    if (percent >= 75) return { title: "Superb Work!", body: "Remarkable intellect. High proficiency demonstrated!", color: "text-blue-600 bg-blue-50 border-blue-200" };
    if (percent >= 50) return { title: "Passed!", body: "A successful attempt! Review incorrect answers to secure a perfect score next time.", color: "text-orange-600 bg-orange-50 border-orange-200" };
    return { title: "Keep Studying", body: "Don't discourage yourself. Revision is the gateway to intelligence. Give it another try!", color: "text-rose-600 bg-rose-50 border-rose-200" };
  };

  if (loading) {
    return (
      <div id="quiz-loading-shield" className="mx-auto max-w-lg py-24 text-center animate-pulse">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-zinc-600 font-medium text-sm">Synchronizing academic modules...</p>
      </div>
    );
  }

  // INTRO PHASE / SUBJECT CHOOSE SCREEN
  if (phase === "intro") {
    const totalCombinationCount = questions.length;

    return (
      <div id="quiz-intro-phase" className="mx-auto max-w-4xl px-4 py-6 space-y-8 animate-fade-in">
        
        {/* Play Banner */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-6 shadow-sm">
            <Trophy className="h-8 w-8" />
          </div>
          
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-zinc-950">
            Student Quiz Dashboard
          </h1>
          <p className="mt-2.5 text-zinc-650 text-sm max-w-lg mx-auto leading-relaxed">
            Welcome! Select one of the customized subjects created by your teacher and begin your test.
          </p>
        </div>

        {/* Subjects List Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-zinc-900 flex items-center">
              <BookOpen className="h-5 w-5 mr-1.5 text-zinc-500" />
              Choose Your Subject
            </h2>
            <span className="text-xs text-zinc-500 font-semibold bg-zinc-100 px-2.5 py-1 rounded-full">
              {subjects.length} {subjects.length === 1 ? "Subject" : "Subjects"} Available
            </span>
          </div>

          {subjects.length === 0 ? (
            <div id="no-subjects-panel" className="bg-zinc-50 rounded-2xl border border-zinc-200 p-12 text-center">
              <BookOpen className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <p className="font-bold text-zinc-800 text-sm">No Subjects Created Yet</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Please wait for your teacher to create subjects and upload question packs inside the Educator portal.
              </p>
            </div>
          ) : (
            <div id="play-subjects-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Optional: All Subjects Combined Card */}
              {totalCombinationCount > 0 && (
                <div
                  id="play-subject-all-mix"
                  onClick={() => startQuizForSubject(null)}
                  className="rounded-2xl border-2 border-indigo-500 bg-indigo-500/5 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group h-full relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 text-indigo-400/20 transform translate-x-2 -translate-y-2 pointer-events-none">
                    <Sparkles className="h-16 w-16" />
                  </div>
                  <div>
                    <span className="inline-flex items-center space-x-1 bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-3">
                      <Sparkles className="h-3 w-3 mr-0.5" />
                      <span>General Mix</span>
                    </span>
                    <h3 className="font-display text-lg font-bold text-indigo-950">
                      All Subjects Mixed
                    </h3>
                    <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
                      A comprehensive mock test spanning all questions across every customized subject in the system.
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-indigo-100/50">
                    <span className="text-xs font-semibold text-indigo-750">
                      {totalCombinationCount} Questions Available
                    </span>
                    <span className="inline-flex items-center space-x-1 font-bold text-xs text-indigo-600 group-hover:translate-x-1 transition-transform">
                      <span>Begin Quiz</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic Subject Cards */}
              {subjects.map((sub) => {
                const subQuestionCount = questions.filter(q => q.subjectId === sub.id).length;
                const isDisabled = subQuestionCount === 0;

                return (
                  <div
                    key={sub.id}
                    id={`play-subject-card-${sub.id}`}
                    onClick={() => !isDisabled && startQuizForSubject(sub)}
                    className={`rounded-2xl border p-5 shadow-sm transition-all h-full flex flex-col justify-between group ${
                      isDisabled 
                        ? "border-zinc-200 bg-zinc-50 opacity-60 cursor-not-allowed" 
                        : "border-zinc-200 bg-white hover:border-orange-300 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div>
                      <div className="mb-3">
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          isDisabled 
                            ? "bg-zinc-150 text-zinc-500" 
                            : "bg-orange-50 text-orange-700 border border-orange-100"
                        }`}>
                          <Tag className="h-2.5 w-2.5 mr-0.5" />
                          <span>Subject Category</span>
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-zinc-950 group-hover:text-orange-600 transition-colors">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Assess your skills and test your limits with standard question modules.
                      </p>
                    </div>

                    <div className={`flex items-center justify-between mt-6 pt-4 border-t ${isDisabled ? "border-zinc-200/50" : "border-zinc-100"}`}>
                      <span className="text-xs font-semibold text-zinc-550">
                        {subQuestionCount} {subQuestionCount === 1 ? "Question" : "Questions"}
                      </span>
                      {isDisabled ? (
                        <span className="text-[10px] font-medium text-zinc-400 italic">No questions added</span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 font-bold text-xs text-orange-600 group-hover:translate-x-1 transition-transform">
                          <span>Start Quiz</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  const currentQuestion = activeQuestions[currentIndex];
  const progressPercent = activeQuestions.length > 0 ? ((currentIndex + 1) / activeQuestions.length) * 100 : 0;
  const currentSelection = selectedAnswers[currentIndex];

  // ACTIVE PLAY PHASE
  if (phase === "active" && currentQuestion) {
    return (
      <div id="quiz-active-phase" className="mx-auto max-w-2xl px-4 py-8 space-y-4 animate-fade-in">
        
        {/* Progress Display */}
        <div id="progress-container" className="space-y-2 bg-white/50 p-4 rounded-xl border border-zinc-150">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-600 uppercase tracking-wider">
            <span className="flex items-center">
              <Tag className="h-3.5 w-3.5 text-zinc-400 mr-1" />
              Subject: <strong className="ml-1 text-zinc-800">{selectedSubject ? selectedSubject.name : "All Subjects mixed"}</strong>
            </span>
            <span>Question {currentIndex + 1} of {activeQuestions.length}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div 
              id="progress-bar-fill"
              className="h-full bg-orange-500 rounded-full transition-all duration-300" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div id="active-question-card" className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-md">
          
          <div className="flex items-center space-x-1.5 text-orange-600 text-xs font-bold uppercase tracking-wider mb-3">
            <Dices className="h-4 w-4" />
            <span>Challenge Active</span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-snug">
            {currentQuestion.text}
          </h2>

          {/* Options grid */}
          <div id="active-options-list" className="mt-8 space-y-3.5">
            {(["A", "B", "C", "D"] as const).map((key) => {
              const isSelected = currentSelection === key;
              return (
                <button
                  key={key}
                  id={`play-opt-btn-${key}`}
                  onClick={() => handleSelectOption(key)}
                  className={`w-full flex items-start text-left rounded-xl p-4 border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-50 border-orange-500 shadow-sm text-zinc-950 font-semibold ring-2 ring-orange-500/10"
                      : "bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100/75 hover:border-zinc-300"
                  }`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center font-display font-extrabold rounded-lg mr-3 shrink-0 text-xs transition-all ${
                    isSelected ? "bg-orange-500 text-white" : "bg-zinc-200 text-zinc-600"
                  }`}>
                    {key}
                  </span>
                  <span className="text-sm leading-snug break-words mt-0.5">
                    {currentQuestion.options[key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Nav Controls */}
          <div id="play-navigation-area" className="flex items-center justify-between border-t border-zinc-100 mt-8 pt-6">
            <p className="text-xs text-zinc-400">
              Select an option to unlocked the Next button
            </p>

            <button
              id="play-next-btn"
              onClick={handleNext}
              disabled={!currentSelection}
              className="flex items-center space-x-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-105 disabled:text-zinc-400 px-6 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer animate-fade-in"
            >
              <span>{currentIndex < activeQuestions.length - 1 ? "Next Question" : "Submit Test"}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const percentageScore = activeQuestions.length > 0 ? Math.round((score / activeQuestions.length) * 100) : 0;
  const description = getScoreDescription(percentageScore);

  // RESULTS PHASE
  return (
    <div id="quiz-results-phase" className="mx-auto max-w-2xl px-4 py-8 space-y-8 animate-fade-in">
      
      {/* Score Summary Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-lg relative overflow-hidden">
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full border border-zinc-50 pointer-events-none z-0"></div>

        <div className="relative z-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-50 text-yellow-600 mb-5 shadow-sm">
            <Award className="h-8 w-8" />
          </div>

          <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1.5">
            Subject: {selectedSubject ? selectedSubject.name : "General Mixed Exam"}
          </p>
          <h1 className="font-display text-4xl font-extrabold text-zinc-950 tracking-tight">Quiz Completed</h1>
          
          <div id="score-readout-circle" className="mt-6 flex flex-col items-center justify-center">
            <div className="rounded-2xl bg-zinc-950 text-white py-4 px-8 shadow-md">
              <span className="block text-4xl font-display font-black tracking-tight">
                {score} / {activeQuestions.length}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                Total Score ({percentageScore}%)
              </span>
            </div>
          </div>

          <div id="score-critique" className={`mt-6 rounded-xl border p-4 max-w-md mx-auto ${description.color}`}>
            <h3 className="font-bold text-sm">{description.title}</h3>
            <p className="text-xs mt-0.5 opacity-90 leading-normal">{description.body}</p>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              id="restart-quiz-btn"
              onClick={restartQuiz}
              className="flex items-center space-x-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Back to Subjects</span>
            </button>
          </div>
        </div>
      </div>

      {/* Review Section */}
      <div id="review-section-root" className="space-y-4">
        <h2 className="font-display text-lg font-bold text-zinc-900 px-1">
          Detailed Challenge Audit
        </h2>

        {activeQuestions.map((question, idx) => {
          const userAns = selectedAnswers[idx];
          const isCorrect = userAns === question.correctAnswer;
          
          return (
            <div 
              key={question.id}
              id={`review-item-${question.id}`}
              className={`rounded-xl border p-5 bg-white shadow-sm space-y-4 ${
                isCorrect ? "border-emerald-100" : "border-rose-100"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 ${
                    isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}>
                    Question {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900 pr-4 leading-normal">
                    {question.text}
                  </h3>
                </div>
                
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 mt-1" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-rose-600 mt-1" />
                )}
              </div>

              {/* Options Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                {(["A", "B", "C", "D"] as const).map((key) => {
                  const isUserSelection = userAns === key;
                  const isCorrectAnswer = question.correctAnswer === key;
                  
                  let optionClass = "bg-zinc-50 border-zinc-150 text-zinc-650";
                  let badgeClass = "bg-zinc-200 text-zinc-500";

                  if (isCorrectAnswer) {
                    optionClass = "bg-emerald-50/50 border-emerald-300 text-emerald-900 font-medium";
                    badgeClass = "bg-emerald-500 text-white";
                  } else if (isUserSelection) {
                    optionClass = "bg-rose-50/50 border-rose-300 text-rose-900 font-medium";
                    badgeClass = "bg-rose-500 text-white";
                  }

                  return (
                    <div
                      key={key}
                      className={`flex items-start text-xs rounded-lg p-3 border ${optionClass}`}
                    >
                      <span className={`inline-flex h-5 w-5 items-center justify-center font-bold rounded-md mr-2.5 shrink-0 text-[10px] ${badgeClass}`}>
                        {key}
                      </span>
                      <div className="leading-snug break-words mt-0.5">
                        <span>{question.options[key]}</span>
                        {isCorrectAnswer && <span className="block text-[9px] font-bold text-emerald-700 mt-0.5 uppercase tracking-wide">✓ Correct Answer</span>}
                        {isUserSelection && !isCorrectAnswer && <span className="block text-[9px] font-bold text-rose-700 mt-0.5 uppercase tracking-wide">✗ Your Selection</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
