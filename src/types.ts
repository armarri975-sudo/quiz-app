export interface Subject {
  id: string;
  name: string;
  createdAt: any;
  createdBy: string;
}

export interface Question {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: "A" | "B" | "C" | "D";
  subjectId: string;
  subjectName: string;
  createdAt: any;
  createdBy: string;
  isPublished?: boolean;
}

export interface AdminUser {
  uid: string;
  email: string | null;
  isAdmin: boolean;
}

export interface QuizScore {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  subjectName: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  createdAt: any;
}
