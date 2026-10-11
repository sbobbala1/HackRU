import React, { useEffect, useState } from 'react';
import { readWorkplace } from './researcherWorkspace';

export default function WorkplaceBadge({ editable=false, onEdit }) {
  const [workplace, setWorkplace] = useState(readWorkplace);
  useEffect(() => { const sync = () => setWorkplace(readWorkplace()); window.addEventListener('vitra-workplace-change', sync); return () => window.removeEventListener('vitra-workplace-change', sync); }, []);
  const lines = [workplace.country, workplace.stateOrRegion, workplace.city, workplace.publicFacilityName].filter(Boolean);
  return <div className="workplace-badge"><span>Researcher workplace</span><b>{lines.length ? lines.slice(0, 2).join(' · ') : 'All public study locations'}</b>{lines.length > 2 && <small>{lines.slice(2).join(' · ')}</small>}{editable && <button className="link-btn" onClick={onEdit}>Change</button>}</div>;
}
