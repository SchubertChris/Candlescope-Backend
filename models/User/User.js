// models/User/User.js
// KORRIGIERT: Doppelte Index-Definitionen entfernt
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // keine doppelten Emails
  },
  password: {
    type: String,
    required: true,
  },
  // OAuth-spezifische Felder (KORRIGIERT: Index-Definitionen vereinfacht)
  googleId: {
    type: String,
    sparse: true, // Ermöglicht mehrere null-Werte
    unique: true  // Aber einzigartig wenn gesetzt
    // KORRIGIERT: Kein zusätzlicher index: true nötig
  },
  githubId: {
    type: String,
    sparse: true, // Ermöglicht mehrere null-Werte
    unique: true  // Aber einzigartig wenn gesetzt
    // KORRIGIERT: Kein zusätzlicher index: true nötig
  },
  name: {
    type: String,
    required: false // Optional für OAuth-User
  },
  avatar: {
    type: String,
    required: false // Optional für OAuth-User
  }
}, {
  timestamps: true // Automatische createdAt/updatedAt Felder
});

export default mongoose.model("User", userSchema);