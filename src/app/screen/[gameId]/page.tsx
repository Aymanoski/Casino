import React from 'react';
import { SkipLink } from '@/components/layout/SkipLink';
import { BigScreenGameView } from '@/components/screen/BigScreenGameView';

export default async function BigScreenGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <>
      <SkipLink />
      <BigScreenGameView gameId={gameId} />
    </>
  );
}
