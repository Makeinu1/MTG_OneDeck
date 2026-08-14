import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { PersonalWorkbench } from '../../components/online/PersonalWorkbench';
import type { PersonalWorkbenchActionV1 } from '../../online/workbench/index';
import fixture from '../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';

export function PersonalWorkbenchFixture() {
  const [lastAction, setLastAction] = useState<PersonalWorkbenchActionV1 | null>(null);
  return (
    <>
      <PersonalWorkbench projection={fixture} interactionState="ready" onAction={setLastAction} />
      <output data-testid="personal-workbench-last-action">
        {lastAction === null ? '操作はまだありません。' : JSON.stringify(lastAction)}
      </output>
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Personal Workbench fixture root is missing');

createRoot(root).render(<PersonalWorkbenchFixture />);
