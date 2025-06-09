// src/auth/useAuth.ts (or directly in a component)
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../firebase";

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("User signed in:", user);
    return user;
  } catch (error) {
    console.error("Error during sign-in:", error);
    return null;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    console.log("User signed out");
  } catch (error) {
    console.error("Error during sign-out:", error);
  }
};
