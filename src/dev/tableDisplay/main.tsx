import { createRoot } from 'react-dom/client';
import '../../index.css';
import { TableDisplay } from '../../components/online/TableDisplay';
import fixture from '../../online/tableDisplay/fixtures/o4p-04b-table-display-v1.json';

export function TableDisplayFixture() {
  return <TableDisplay projection={fixture} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Table Display fixture root is missing');

createRoot(root).render(<TableDisplayFixture />);
