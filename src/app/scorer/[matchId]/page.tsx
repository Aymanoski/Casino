import React from 'react';
import { ScorerConsoleView } from '@/components/scorer/ScorerConsoleView';

export default async function ScorerMatchConsolePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <ScorerConsoleView matchId={matchId} />;
}
