
const sbReady=window.SUPABASE_URL&&!window.SUPABASE_URL.startsWith("YOUR_")&&window.SUPABASE_ANON_KEY&&!window.SUPABASE_ANON_KEY.startsWith("YOUR_");
const sb=sbReady?supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY):null;
let user=null,mode="login",activeSubject=null,activeQuiz=null,current=0;
let answers={},submitted={},score=0,questionOrder=[];
let subjects=[],quizzes=[],dbQuestions=[],isAdmin=false;
const $=x=>document.getElementById(x), letters=["A","B","C","D"];

const CSS=`
.qc-wrap{margin-top:8px}.qc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.qc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.qc-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;cursor:pointer;transition:.15s;text-align:left;font:inherit;color:inherit;width:100%}
.qc-card:hover{transform:translateY(-2px);box-shadow:0 10px 25px #1e23370d;border-color:#cfc9ff}
.qc-card h3{margin:5px 0 6px}.qc-card p{margin:0;font-size:14px}.qc-icon{font-size:30px;margin-bottom:8px}
.qc-tag{display:inline-block;margin-top:12px;padding:4px 9px;border-radius:99px;background:var(--soft);color:var(--accent);font-size:12px;font-weight:700}
.qc-meta{display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:var(--muted)}
.qc-progress{height:7px;background:#e8ebf2;border-radius:99px;margin-top:13px;overflow:hidden}.qc-progress div{height:100%;background:var(--accent)}
.qc-danger{font-size:18px}.qc-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.admin-box{background:#f8f9fc;border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:14px}
.admin-box textarea{min-height:240px;font-family:monospace;font-size:13px}
.admin-list{display:grid;gap:10px;margin-top:14px}.admin-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;background:#fff;border:1px solid var(--line);border-radius:12px}
.notice{padding:12px;border-radius:12px;background:#fff8df;margin-top:10px;font-size:13px}
`;

function injectStyle(){if($("qcStyle"))return;let s=document.createElement("style");s.id="qcStyle";s.textContent=CSS;document.head.appendChild(s)}

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function injectUI(){
  injectStyle();
  if($("subjects"))return;
  const main=document.querySelector("main");

  const subjects=document.createElement("section");
  subjects.id="subjects";subjects.className="card hidden qc-wrap";
  main.insertBefore(subjects,$("quiz"));

  const back=document.createElement("button");
  back.id="quizBack";back.className="ghost";back.type="button";back.textContent="← กลับ";
  $("quiz").insertBefore(back,$("quiz").firstChild);
  back.onclick=()=>showQuizzes();

  const resultBack=document.createElement("button");
  resultBack.id="resultBack";resultBack.className="ghost";resultBack.type="button";resultBack.textContent="← กลับไปเลือกบท";
  $("result").appendChild(resultBack);resultBack.onclick=()=>showQuizzes();
}

async function getSubjects(){
  if(!sb)return [];
  const r=await sb.from("subjects").select("*").eq("is_published",true).order("sort_order").order("name");
  return r.error?[]:(r.data||[]);
}
async function getQuizzes(subjectId){
  if(!sb)return [];
  const r=await sb.from("quizzes").select("*").eq("subject_id",subjectId).eq("is_published",true).order("sort_order").order("created_at");
  return r.error?[]:(r.data||[]);
}
async function getProgress(quizId){
  if(!sb||!user)return {answers:{},submitted:{},viewed:false};
  const r=await sb.from("user_quiz_progress").select("*").eq("user_id",user.id).eq("quiz_id",quizId).maybeSingle();
  return (!r.error&&r.data)?{answers:r.data.answers||{},submitted:r.data.submitted||{},viewed:!!r.data.viewed}:{answers:{},submitted:{},viewed:false};
}
async function setViewed(quizId){
  if(!sb||!user)return;
  await sb.from("user_quiz_progress").upsert({user_id:user.id,quiz_id:quizId,viewed:true,updated_at:new Date().toISOString()},{onConflict:"user_id,quiz_id"});
}
async function saveProgress(){
  if(!sb||!user||!activeQuiz)return;
  await sb.from("user_quiz_progress").upsert({
    user_id:user.id,quiz_id:activeQuiz.id,answers,submitted,
    viewed:true,updated_at:new Date().toISOString()
  },{onConflict:"user_id,quiz_id"});
}

async function loadQuestions(quizId){
  if(!sb)return [];
  const r=await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order").order("created_at");
  if(r.error)return [];
  return (r.data||[]).map(q=>({
    id:q.id,question:q.question,
    options:{A:q.option_a,B:q.option_b,C:q.option_c,D:q.option_d},
    answer:q.answer,explanation:q.explanation||""
  }));
}

function showSubjects(){
  injectUI();
  $("subjects").classList.remove("hidden");$("quiz").classList.add("hidden");$("result").classList.add("hidden");
  document.querySelector("header h1").textContent="ศูนย์รวมแบบทดสอบ";
  document.querySelector("header p").textContent="เลือกวิชาที่ต้องการติว";
  renderSubjects();
}

async function renderSubjects(){
  subjects=await getSubjects();
  const box=$("subjects");
  box.innerHTML=`<div class="qc-head"><div><small>QUIZ CENTER</small><h2>เลือกวิชา</h2><p>เลือกวิชาเพื่อดูบทเรียน แบบทบทวน และชุดติวสอบ</p></div>${isAdmin?'<button class="primary" id="adminBtn">⚙ จัดการเนื้อหา</button>':""}</div><div class="qc-grid" id="subjectGrid"></div>`;
  if(isAdmin)$("adminBtn").onclick=showAdmin;
  const grid=$("subjectGrid");
  if(!subjects.length){
    grid.innerHTML=`<div class="notice">ยังไม่มีวิชาในระบบ</div>`;return;
  }
  subjects.forEach(s=>{
    const b=document.createElement("button");b.className="qc-card";b.type="button";
    b.innerHTML=`<div class="qc-icon">${esc(s.icon||"📚")}</div><h3>${esc(s.name)}</h3><p>${esc(s.description||"เลือกเพื่อดูบทเรียน")}</p><span class="qc-tag">เข้าสู่วิชา →</span>`;
    b.onclick=()=>showQuizzesFor(s);
    grid.appendChild(b);
  });
}

async function showQuizzesFor(subject){
  activeSubject=subject;
  injectUI();$("subjects").classList.remove("hidden");$("quiz").classList.add("hidden");$("result").classList.add("hidden");
  document.querySelector("header h1").textContent=subject.name;
  document.querySelector("header p").textContent="เลือกบทหรือชุดติวสอบ";
  quizzes=await getQuizzes(subject.id);
  const box=$("subjects");
  box.innerHTML=`<div class="qc-head"><div><small>${esc(subject.icon||"📚")} ${esc(subject.name)}</small><h2>เลือกบท</h2><p>🚨 แปลว่ายังไม่เคยเปิดดูชุดนี้</p></div><button class="ghost" id="backSubjects">← วิชา</button></div><div class="qc-grid" id="quizGrid"></div>`;
  $("backSubjects").onclick=showSubjects;
  const grid=$("quizGrid");
  for(const q of quizzes){
    const p=await getProgress(q.id);
    const total=q.quiz_size||30;
    const done=Object.keys(p.submitted).length;
    const pct=Math.min(100,Math.round(done/total*100));
    const card=document.createElement("button");card.type="button";card.className="qc-card";
    card.innerHTML=`<small>${esc(q.kind_label||q.kind||"แบบทดสอบ")}</small><h3>${esc(q.title)}</h3><p>${esc(q.description||"")}</p><div class="qc-progress"><div style="width:${pct}%"></div></div><div class="qc-meta"><span>ความคืบหน้า ${done}/${total}</span><span>${pct}%</span></div>${!p.viewed?'<div class="qc-tag qc-danger">🚨 ใหม่</div>':'<div class="qc-tag">ทำต่อ →</div>'}`;
    card.onclick=()=>openQuiz(q);
    grid.appendChild(card);
  }
}

async function openQuiz(q){
  activeQuiz=q;
  await setViewed(q.id);
  const p=await getProgress(q.id);
  answers=p.answers;submitted=p.submitted;score=0;
  dbQuestions=await loadQuestions(q.id);

  // Legacy fallback: the original 50 questions can still be used for the old Law set.
  if(!dbQuestions.length && q.legacy_from){
    dbQuestions=QUESTIONS.filter(x=>x.id>=q.legacy_from&&x.id<=q.legacy_to);
  }
  questionOrder=dbQuestions.map((_,i)=>i);
  current=questionOrder.find(i=>!submitted[dbQuestions[i].id]) ?? 0;
  showQuiz();
  render();
}

function showQuiz(){
  $("subjects").classList.add("hidden");$("quiz").classList.remove("hidden");$("result").classList.add("hidden");
  document.querySelector("header h1").textContent=activeQuiz.title;
  document.querySelector("header p").textContent=`${activeSubject.name} • ${activeQuiz.quiz_size||dbQuestions.length} ข้อ`;
}

function currentQ(){return dbQuestions[questionOrder[current]]}

function render(){
  if(!activeQuiz)return;
  const total=activeQuiz.quiz_size||dbQuestions.length;
  const answered=Object.keys(submitted).length;
  if(answered>=Math.min(total,dbQuestions.length)){
    showResult();return;
  }
  const q=currentQ();if(!q){showResult();return}
  const done=!!submitted[q.id];
  $("qnum").textContent=`ข้อ ${current+1}`;
  $("progressText").textContent=`${activeQuiz.title} • ตอบแล้ว ${answered}/${total} ข้อ`;
  $("bar").style.width=(Math.min(100,answered/total*100))+"%";
  $("question").textContent=q.question;$("badge").textContent=done?(submitted[q.id]===q.answer?"ถูก":"ผิด"):"ยังไม่ตอบ";
  $("options").innerHTML="";
  letters.forEach(l=>{
    const b=document.createElement("button");b.className="option";
    if(answers[q.id]===l)b.classList.add("selected");
    if(done&&q.answer===l)b.classList.add("correct");
    if(done&&answers[q.id]===l&&answers[q.id]!==q.answer)b.classList.add("wrong");
    b.disabled=done;b.innerHTML=`<span class="letter">${l}</span><span>${esc(q.options[l])}</span>`;
    b.onclick=()=>{answers[q.id]=l;render();saveProgress()};$("options").appendChild(b);
  });
  if(done){
    $("feedback").className="feedback "+(submitted[q.id]===q.answer?"good":"bad");$("feedback").classList.remove("hidden");
    $("fbtitle").textContent=submitted[q.id]===q.answer?"✓ ถูกต้อง":"✕ ยังไม่ถูก — คำตอบที่ถูกคือ "+q.answer;
    $("explanation").textContent=q.explanation;
    $("submit").classList.add("hidden");$("next").classList.remove("hidden");
    $("next").textContent=current>=dbQuestions.length-1?"ดูผลคะแนน →":"ไปข้อถัดไป →";
  }else{
    $("feedback").classList.add("hidden");$("submit").classList.remove("hidden");$("next").classList.add("hidden");
    $("submit").disabled=!answers[q.id];
  }
}

async function submitAnswer(){
  const q=currentQ();if(!q||!answers[q.id])return;
  submitted[q.id]=answers[q.id];
  score=dbQuestions.filter(x=>submitted[x.id]===x.answer).length;
  await saveProgress();render();
}
$("submit").onclick=submitAnswer;
$("next").onclick=()=>{if(current<dbQuestions.length-1){current++;render();saveProgress()}else render()};
$("reset").onclick=async()=>{if(confirm("ล้างคำตอบของชุดนี้และเริ่มใหม่หรือไม่?")){answers={};submitted={};score=0;current=0;await saveProgress();render()}};

function showResult(){
  $("quiz").classList.add("hidden");$("result").classList.remove("hidden");
  const total=activeQuiz.quiz_size||dbQuestions.length;const s=dbQuestions.filter(q=>submitted[q.id]===q.answer).length;const pct=total?Math.round(s/total*100):0;
  $("score").textContent=`${s} / ${total}`;$("result").querySelector("h2").textContent=`${activeQuiz.title} — เสร็จแล้ว`;
  $("resultText").textContent=pct>=80?"ระดับดีมาก — ทบทวนเฉพาะข้อที่ผิด":pct>=60?"ผ่านระดับพื้นฐาน — แนะนำให้ทบทวนข้อที่ผิด":"ควรกลับไปทบทวนเนื้อหาแล้วลองใหม่";
  $("review").textContent="ทบทวนชุดนี้";$("retake").textContent="ทำชุดนี้ใหม่";$("resultBack").textContent="← กลับไปเลือกบท";
}
$("review").onclick=()=>{current=0;render()};
$("retake").onclick=async()=>{answers={};submitted={};score=0;current=0;await saveProgress();render()};
$("resultBack").onclick=()=>showQuizzesFor(activeSubject);

async function showQuizzes(){if(activeSubject)await showQuizzesFor(activeSubject);else showSubjects()}

/* ---------- Admin/content management ---------- */
async function checkAdmin(){
  if(!sb||!user)return false;
  const r=await sb.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
  return !r.error&&!!r.data;
}

function showAdmin(){
  $("subjects").classList.remove("hidden");$("quiz").classList.add("hidden");$("result").classList.add("hidden");
  document.querySelector("header h1").textContent="จัดการเนื้อหา";
  document.querySelector("header p").textContent="เพิ่มวิชาและนำเข้าข้อสอบจาก GPT โดยไม่ต้องแก้ GitHub";
  $("subjects").innerHTML=`
    <div class="qc-head"><div><small>ADMIN</small><h2>จัดการ Quiz Center</h2><p>เพิ่มข้อมูลจากหน้าเว็บได้โดยตรง</p></div><button class="ghost" id="adminBack">← กลับ</button></div>
    <div class="admin-box"><h3>1. เพิ่มวิชา</h3><label>ชื่อวิชา<input id="newSubjectName" placeholder="เช่น PPM"></label><label>ไอคอน<input id="newSubjectIcon" placeholder="เช่น 📊"></label><label>คำอธิบาย<input id="newSubjectDesc" placeholder="เช่น Project Planning and Management"></label><button class="primary" id="addSubject">เพิ่มวิชา</button><div id="adminMsg1"></div></div>
    <div class="admin-box"><h3>2. นำเข้าชุดข้อสอบจาก GPT</h3>
      <p>วาง JSON จาก GPT ได้เลย ระบบจะสร้างวิชา/ชุดข้อสอบให้ถ้ายังไม่มี</p>
      <textarea id="importJson" placeholder='{
  "subject":"PPM",
  "subject_icon":"📊",
  "subject_description":"Project Planning and Management",
  "quiz":{
    "title":"บทที่ 1 เรื่อง...",
    "type":"chapter",
    "quiz_size":30,
    "description":"...",
    "questions":[
      {
        "question":"...",
        "options":{"A":"...","B":"...","C":"...","D":"..."},
        "answer":"B",
        "explanation":"..."
      }
    ]
  }
}'></textarea>
      <button class="primary" id="importQuiz">นำเข้าข้อสอบ</button><div id="adminMsg2"></div>
    </div>
    <div class="admin-box"><h3>รูปแบบชุดข้อสอบที่รองรับ</h3><p>type: <b>chapter</b>, <b>combined</b>, <b>midterm</b> หรือ <b>final</b></p><p>quiz_size คือจำนวนข้อที่จะให้ผู้เรียนทำ เช่น 30 แม้ในคลังจะมี 50 ข้อก็ได้</p></div>
  `;
  $("adminBack").onclick=showSubjects;
  $("addSubject").onclick=addSubject;
  $("importQuiz").onclick=importQuiz;
}

async function addSubject(){
  const name=$("newSubjectName").value.trim();if(!name)return;
  const r=await sb.from("subjects").insert({name,icon:$("newSubjectIcon").value.trim()||"📚",description:$("newSubjectDesc").value.trim(),is_published:true,sort_order:0}).select().single();
  $("adminMsg1").textContent=r.error?r.error.message:"เพิ่มวิชาแล้ว";
  if(!r.error){$("newSubjectName").value="";$("newSubjectIcon").value="";$("newSubjectDesc").value=""}
}

function parseImport(text){
  let t=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  const data=JSON.parse(t);
  if(Array.isArray(data))return {subject:null,quiz:{title:"แบบทดสอบ",quiz_size:data.length,questions:data}};
  if(data.questions)return data;
  if(data.quiz?.questions)return data;
  throw new Error("ไม่พบ questions ใน JSON");
}

async function importQuiz(){
  const msg=$("adminMsg2");msg.textContent="";
  try{
    const data=parseImport($("importJson").value);
    let subject=data.subject||data.quiz?.subject;
    const quizData=data.quiz||data;
    if(!subject)throw new Error("ต้องมี subject");

    let sr=await sb.from("subjects").select("*").eq("name",subject).maybeSingle();
    let subjectRow=sr.data;
    if(!subjectRow){
      const ins=await sb.from("subjects").insert({
        name:subject,icon:data.subject_icon||"📚",description:data.subject_description||"",is_published:true,sort_order:0
      }).select().single();
      if(ins.error)throw ins.error;subjectRow=ins.data;
    }

    const title=quizData.title||"แบบทดสอบ";
    const qr=await sb.from("quizzes").insert({
      subject_id:subjectRow.id,title,
      kind:quizData.type||"chapter",
      kind_label:quizData.kind_label||({"chapter":"บท","combined":"บทรวม","midterm":"ติวสอบกลางภาค","final":"ติวปลายภาค"}[quizData.type||"chapter"]||"แบบทดสอบ"),
      description:quizData.description||"",
      quiz_size:Number(quizData.quiz_size||quizData.questions.length||30),
      is_published:true,sort_order:0
    }).select().single();
    if(qr.error)throw qr.error;

    const rows=(quizData.questions||[]).map((q,i)=>({
      quiz_id:qr.data.id,question:q.question,
      option_a:q.options?.A||q.A||"",option_b:q.options?.B||q.B||"",
      option_c:q.options?.C||q.C||"",option_d:q.options?.D||q.D||"",
      answer:q.answer,explanation:q.explanation||"",sort_order:i
    }));
    const insq=await sb.from("questions").insert(rows);
    if(insq.error)throw insq.error;
    msg.textContent=`นำเข้าสำเร็จ: ${subject} / ${title} / ${rows.length} ข้อ`;
    $("importJson").value="";
  }catch(e){msg.textContent="นำเข้าไม่สำเร็จ: "+(e.message||e)}
}

/* ---------- Auth ---------- */
$("loginTab").onclick=()=>{mode="login";$("loginTab").classList.add("active");$("signupTab").classList.remove("active");$("authSubmit").textContent="เข้าสู่ระบบ"};
$("signupTab").onclick=()=>{mode="signup";$("signupTab").classList.add("active");$("loginTab").classList.remove("active");$("authSubmit").textContent="สมัครบัญชี"};

$("authForm").onsubmit=async e=>{
  e.preventDefault();

  const msg=$("authMsg");

  if(!sb){
    msg.textContent="ยังไม่ได้ตั้งค่า Supabase ใน config.js";
    return;
  }

  const email=$("email").value.trim();
  const password=$("password").value;

  if(!email||!password){
    msg.textContent="กรุณากรอกอีเมลและรหัสผ่าน";
    return;
  }

  msg.textContent="กำลังเข้าสู่ระบบ...";

  try{
    let r;

    if(mode==="signup"){
      r=await sb.auth.signUp({
        email,
        password
      });
    }else{
      r=await sb.auth.signInWithPassword({
        email,
        password
      });
    }
    if(r.error){
      console.error("Supabase Auth Error:",r.error);
      msg.textContent=
        "เข้าสู่ระบบไม่ได้: "+r.error.message;
      return;
    }
    if(mode==="signup"){
      if(r.data.session){
        user=r.data.user;
        await start();
      }else{
        msg.textContent=
          "สมัครสำเร็จ แต่ต้องยืนยันอีเมลก่อนเข้าสู่ระบบ";
      }
    }else{
      if(!r.data.user){
        msg.textContent="ไม่พบข้อมูลผู้ใช้";
        return;
      }
      user=r.data.user;
      await start();
    }
  }catch(err){
    console.error("Login Error:",err);

    msg.textContent=
      "เกิดข้อผิดพลาด: "+(err?.message||String(err));
  }
};
async function start(){
  injectUI();$("account").textContent=user.email;$("auth").classList.add("hidden");
  isAdmin=await checkAdmin();showSubjects();
}

(async()=>{
  injectUI();
  if(!sb){$("authMsg").textContent="เว็บพร้อมแล้ว แต่ต้องตั้งค่า Supabase"}else{
    const r=await sb.auth.getSession();
    if(r.data.session){user=r.data.session.user;await start()}
  }
})();
    
