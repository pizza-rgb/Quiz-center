/*
 * Quiz Center learner auth + remote attempt helper.
 * This file is a helper module, not a drop-in replacement for app.js.
 * Requires the existing global `sb` Supabase client.
 */
window.QuizCenterAuth = (() => {
  const $ = (id) => document.getElementById(id);

  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    if (!data.user) throw new Error("ไม่พบข้อมูลผู้เรียน");
    return data.user;
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function currentUser() {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session?.user || null;
  }

  async function beginAttempt(userId, quizId, totalQuestions) {
    const { data, error } = await sb.from("quiz_attempts").insert({
      user_id: userId,
      quiz_id: quizId,
      answers: {},
      submitted: {},
      score: 0,
      total_questions: totalQuestions,
      status: "in_progress"
    }).select("id,user_id,quiz_id,answers,submitted,score,total_questions,status,started_at,completed_at,updated_at").single();
    if (error) throw error;
    return data;
  }

  async function updateAttempt(attemptId, userId, payload) {
    const allowed = {
      answers: payload.answers || {},
      submitted: payload.submitted || {},
      score: Number(payload.score || 0),
      total_questions: Number(payload.total_questions || 0),
      status: payload.status || "in_progress",
      updated_at: new Date().toISOString()
    };
    if (allowed.status === "completed") allowed.completed_at = new Date().toISOString();

    const { data, error } = await sb.from("quiz_attempts")
      .update(allowed)
      .eq("id", attemptId)
      .eq("user_id", userId)
      .select("id,status,score,total_questions,updated_at,completed_at")
      .single();
    if (error) throw error;
    return data;
  }

  async function listHistory() {
    const user = await currentUser();
    if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนดูประวัติ");
    const { data, error } = await sb.from("quiz_attempts")
      .select("id,quiz_id,score,total_questions,status,started_at,completed_at,updated_at,quizzes(title)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return { signUp, signIn, signOut, currentUser, beginAttempt, updateAttempt, listHistory };
})();
