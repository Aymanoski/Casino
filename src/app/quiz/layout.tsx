import React from 'react';
import { QuizApplicantShell } from '@/components/quiz/QuizApplicantShell';

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QuizApplicantShell>{children}</QuizApplicantShell>;
}
