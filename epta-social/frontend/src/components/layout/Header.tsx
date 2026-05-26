import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/auth';

export function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header style={{ padding: '1rem', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>ЕПТА</Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to={`/profile/${user?.username}`}>{user?.displayName}</Link>
          <button onClick={logout}>Выход</button>
        </div>
      </div>
    </header>
  );
}
