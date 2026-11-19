import React from 'react';
import { ScorerConsoleView } from '@/components/scorer';

export default async function ScorerGameConsolePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return <ScorerConsoleView gameId={gameId} />;
}
