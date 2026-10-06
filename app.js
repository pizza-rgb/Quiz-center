const sbReady=window.SUPABASE_URL&&!window.SUPABASE_URL.startsWith("YOUR_")&&window.SUPABASE_ANON_KEY&&!window.SUPABASE_ANON_KEY.startsWith("YOUR_");
const sb=sbReady?supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY):null;

let user=null,mode="login",current=0,answers={},submitted={},score=0;
const $=x=>document.getElementById(x), letters="ABCD".split("");

/* ---------- Quiz Center: Phase 1 ---------- */
function injectQuizCenter(){
  if($("subjects")) return;

  const style=document.createElement("style");
  style.textContent=`
    .qc-wrap{margin-top:8px}
    .qc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
    .qc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .qc-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;cursor:pointer;transition:.15s;text-align:left}
    .qc-card:hover{transform:translateY(-2px);box-shadow:0 10px 25px #1e23370d;border-color:#cfc9ff}
    .qc-icon{font-size:30px;margin-bottom:8px}
    .qc-card h3{margin:4px 0 6px}
    .qc-card p{margin:0;font-size:14px}
    .qc-tag{display:inline-block;margin-top:12px;padding:4px 9px;border-radius:99px;background:var(--soft);color:var(--accent);font-size:12px;font-weight:700}
    .qc-back{margin-bottom:14px}
  `;
  document.head.appendChild(style);

  const sec=document.createElement("section");
  sec.id="subjects";
  sec.className="card hidden qc-wrap";
  sec.innerHTML=`
    <div class="qc-head">
      <div>
        <small>QUIZ CENTER</small>
        <h2>เลือกวิชา</h2>
        <p>เลือกวิชาเพื่อเข้าสู่บทเรียนและแบบทดสอบของวิชานั้น</p>
      </div>
    </div>
    <div class="qc-grid">
      <button class="qc-card" id="lawSubject" type="button">
        <div class="qc-icon">⚖️</div>
        <h3>กฎหมายแรงงาน</h3>
        <p>สัญญาจ้างแรงงานและสัญญาจ้างทำของ</p>
        <span class="qc-tag">50 ข้อ • พร้อมทำแบบทดสอบ</span>
      </button>
    </div>
  `;

  const main=document.querySelector("main");
  main.insertBefore(sec,$("quiz"));

  const back=document.createElement("button");
  back.id="backSubjects";
  back.className="ghost qc-back";
  back.type="button";
  back.textContent="← วิชา";
  $("quiz").insertBefore(back,$("quiz").firstChild);

  const resultBack=document.createElement("button");
  resultBack.id="resultSubjects";
  resultBack.className="ghost";
  resultBack.type="button";
  resultBack.textContent="← กลับไปเลือกวิชา";
  $("result").appendChild(resultBack);

  $("lawSubject").onclick=()=>openLaw();
  back.onclick=()=>showSubjects();
  resultBack.onclick=()=>showSubjects();

  $("review").onclick=()=>{current=0;showLawQuiz();render()};
  $("retake").onclick=async()=>{answers={};submitted={};score=0;current=0;await save();showLawQuiz();render()};
}

function showSubjects(){
  injectQuizCenter();
  $("subjects").classList.remove("hidden");
  $("quiz").classList.add("hidden");
  $("result").classList.add("hidden");
  document.querySelector("header h1").textContent="ศูนย์รวมแบบทดสอบ";
  document.querySelector("header p").textContent="เลือกวิชาเพื่อเริ่มทำแบบทดสอบ";
}

async function openLaw(){
  injectQuizCenter();
  await load();
  showLawQuiz();
  render();
}

function showLawQuiz(){
  $("subjects").classList.add("hidden");
  $("quiz").classList.remove("hidden");
  $("result").classList.add("hidden");
  document.querySelector("header h1").textContent="กฎหมายแรงงาน";
  document.querySelector("header p").textContent="สัญญาจ้างแรงงานและสัญญาจ้างทำของ • 50 ข้อ";
}

/* ---------- Existing quiz logic ---------- */
function localSave(){
  localStorage.setItem("lawQuizProgress",JSON.stringify({answers,submitted,score,current}))
}

async function save(){
  localSave();
  if(!sb||!user){
    if($("saveStatus")) $("saveStatus").textContent="บันทึกไว้ในเครื่องนี้";
    return
  }
  const {error}=await sb.from("quiz_progress").upsert({
    user_id:user.id,
    answers,
    submitted,
    score,
    completed:Object.keys(submitted).length===50,
    updated_at:new Date().toISOString()
  });
  if($("saveStatus")) $("saveStatus").textContent=error?"บันทึกออนไลน์ไม่สำเร็จ":"บันทึกคำตอบแล้ว";
}

function nextUnanswered(){
  for(let i=0;i<50;i++) if(!submitted[i+1]) return i;
  return 49
}

async function load(){
  if(sb&&user){
    let r=await sb.from("quiz_progress").select("*").eq("user_id",user.id).maybeSingle();
    if(!r.error&&r.data){
      answers=r.data.answers||{};
      submitted=r.data.submitted||{};
      score=r.data.score||0;
      current=nextUnanswered();
      return
    }
  }
  try{
    let d=JSON.parse(localStorage.getItem("lawQuizProgress")||"{}");
    answers=d.answers||{};
    submitted=d.submitted||{};
    score=d.score||0;
    current=nextUnanswered()
  }catch{}
}

function esc(s){
  return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))
}

function render(){
  if(Object.keys(submitted).length===50){
    $("quiz").classList.add("hidden");
    $("result").classList.remove("hidden");
    $("score").textContent=score+" / 50";
    let p=score*2;
    $("resultText").textContent=p>=80
      ?"ระดับดีมาก — ทบทวนเฉพาะข้อที่ผิด"
      :p>=60
      ?"ผ่านระดับพื้นฐาน แต่ยังมีบางหัวข้อที่ควรทบทวน"
      :"ควรกลับไปทบทวนเนื้อหาหลักแล้วลองทำใหม่";
    return
  }

  $("result").classList.add("hidden");
  $("quiz").classList.remove("hidden");

  let q=QUESTIONS[current],done=!!submitted[q.id];
  $("qnum").textContent="ข้อ "+q.id;
  $("progressText").textContent="ข้อ "+q.id+" / 50 • ตอบแล้ว "+Object.keys(submitted).length+" ข้อ";
  $("bar").style.width=((q.id-1)/50*100)+"%";
  $("question").textContent=q.question;
  $("badge").textContent=done?(submitted[q.id]===q.answer?"ถูก":"ผิด"):"ยังไม่ตอบ";
  $("options").innerHTML="";

  letters.forEach(l=>{
    let b=document.createElement("button");
    b.className="option";
    if(answers[q.id]===l)b.classList.add("selected");
    if(done&&q.answer===l)b.classList.add("correct");
    if(done&&answers[q.id]===l&&answers[q.id]!==q.answer)b.classList.add("wrong");
    b.disabled=done;
    b.innerHTML='<span class="letter">'+l+'</span><span>'+esc(q.options[l])+'</span>';
    b.onclick=()=>{answers[q.id]=l;render();save()};
    $("options").appendChild(b)
  });

  if(done){
    $("feedback").className="feedback "+(submitted[q.id]===q.answer?"good":"bad");
    $("feedback").classList.remove("hidden");
    $("fbtitle").textContent=submitted[q.id]===q.answer?"✓ ถูกต้อง":"✕ ยังไม่ถูก — คำตอบที่ถูกคือ "+q.answer;
    $("explanation").textContent=q.explanation;
    $("submit").classList.add("hidden");
    $("next").classList.remove("hidden");
    $("next").textContent=current===49?"ดูผลคะแนน →":"ไปข้อถัดไป →";
  }else{
    $("feedback").classList.add("hidden");
    $("submit").classList.remove("hidden");
    $("next").classList.add("hidden");
    $("submit").disabled=!answers[q.id]
  }
}

$("submit").onclick=async()=>{
  let q=QUESTIONS[current];
  if(!answers[q.id])return;
  submitted[q.id]=answers[q.id];
  if(answers[q.id]===q.answer)score++;
  await save();
  render()
}

$("next").onclick=()=>{
  if(current<49){
    current++;
    render();
    save()
  }else render()
}

$("reset").onclick=async()=>{
  if(confirm("ล้างคำตอบทั้งหมดและเริ่มใหม่หรือไม่?")){
    answers={};submitted={};score=0;current=0;
    await save();
    render()
  }
}

$("review").onclick=()=>{
  injectQuizCenter();
  current=0;
  showLawQuiz();
  render()
}

$("retake").onclick=async()=>{
  injectQuizCenter();
  answers={};submitted={};score=0;current=0;
  await save();
  showLawQuiz();
  render()
}

$("loginTab").onclick=()=>{
  mode="login";
  $("loginTab").classList.add("active");
  $("signupTab").classList.remove("active");
  $("authSubmit").textContent="เข้าสู่ระบบ"
}

$("signupTab").onclick=()=>{
  mode="signup";
  $("signupTab").classList.add("active");
  $("loginTab").classList.remove("active");
  $("authSubmit").textContent="สมัครบัญชี"
}

$("authForm").onsubmit=async e=>{
  e.preventDefault();
  if(!sb){
    $("authMsg").textContent="ยังไม่ได้ตั้งค่า Supabase ใน config.js";
    return
  }

  let email=$("email").value.trim(),password=$("password").value;
  let r=mode==="signup"
    ?await sb.auth.signUp({email,password})
    :await sb.auth.signInWithPassword({email,password});

  if(r.error){
    $("authMsg").textContent=r.error.message;
    return
  }

  if(mode==="signup"&&!r.data.session){
    $("authMsg").textContent="สมัครสำเร็จ กรุณาตรวจอีเมลถ้าระบบเปิดการยืนยันอีเมล";
  }else{
    user=r.data.user;
    await start()
  }
}

async function start(){
  injectQuizCenter();
  await load();
  $("account").textContent=user.email;
  $("auth").classList.add("hidden");
  showSubjects();
}

(async()=>{
  injectQuizCenter();
  if(!sb){
    $("authMsg").textContent="เว็บพร้อมแล้ว แต่ต้องตั้งค่า Supabase เพื่อเปิดระบบบัญชีและบันทึกข้ามอุปกรณ์";
  }else{
    let r=await sb.auth.getSession();
    if(r.data.session){
      user=r.data.session.user;
      await start()
    }
  }
})()
