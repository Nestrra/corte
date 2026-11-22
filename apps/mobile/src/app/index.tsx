import { Redirect } from 'expo-router';
import { useSessionStore } from '../session/session-store';

/**
 * Entry route "/". The (auth) and (app) groups have no index of their own, so "/" sends the user
 * to the right group: /home with a session, /login without one. It is never protected, so it is
 * also where Stack.Protected lands when the session changes (it redirects to the anchor/index).
 */
export default function Index() {
  const status = useSessionStore((state) => state.status);
  return <Redirect href={status === 'signedIn' ? '/home' : '/login'} />;
}
