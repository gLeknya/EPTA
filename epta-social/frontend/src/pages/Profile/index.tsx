import { useParams } from 'react-router-dom';

export function Profile() {
  const { username } = useParams<{ username: string }>();

  return (
    <div>
      <h1>Профиль: @{username}</h1>
      <p>Страница в разработке</p>
    </div>
  );
}
