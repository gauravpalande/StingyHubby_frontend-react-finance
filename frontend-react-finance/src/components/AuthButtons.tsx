// src/components/AuthButtons.tsx
import React, { useState } from "react";
import { loginWithGoogle, logout } from "../auth/useAuth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

const AuthButtons: React.FC = () => {
  const [user, setUser] = useState<any>(null);

  React.useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  return (
    <div>
      {user ? (
        <>
          <p>Welcome, {user.displayName}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={loginWithGoogle}>Login with Google</button>
      )}
    </div>
  );
};

export default AuthButtons;
