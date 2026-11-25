import { createContext, useContext } from "react";
import type { MeDto } from "@/lib/api";

/** Akun yang sedang login. Hanya untuk menampilkan/menyembunyikan UI; izin dicek di server. */
export const MeContext = createContext<MeDto>({ username: "", role: "user" });

export const useIsAdmin = () => useContext(MeContext).role === "admin";
