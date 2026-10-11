import React, { useEffect, useState } from 'react';
import { readWorkplace } from './researcherWorkspace';

export default function WorkplaceBadge({ editable=false, onEdit }) {
  const [workplace, setWorkplace] = useState(readWorkplace);
  useEffect(() => { const sync = () => setWorkplace(readWorkplace()); window.addEventListener('vitra-workplace-change', sync); return () => window.removeEventListener('vitra-workplace-change', sync); }, []);
  return <div className="workplace-badge"><span>Researcher workplace</span><b>{workplace.label}</b>{editable && <button className="link-btn" onClick={onEdit}>Change</button>}</div>;
}
