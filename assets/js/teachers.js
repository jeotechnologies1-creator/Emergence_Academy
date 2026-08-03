// Teacher helpers
    function getTeacherCourses() {
      return db.courses.filter(c => c.teacher === appState.user.name);
    }
    function getTeacherStudents(){
      const titles = getTeacherCourses().map(c => c.title);
      return db.students.filter(s => s.courses.some(sc => titles.includes(sc)));
    }
    function getTeacherAssignments(){
      const titles = getTeacherCourses().map(c => c.title);
      return db.assignments.filter(a => titles.includes(a.course));
 }
    function getStudentRecord(){ return db.students.find(s => s.name === appState.user.name) || db.students[0]; }
    function getChildRecord(){ return db.students[0]; }

    // Tutor Chat
    function sendTutor() {
      const inp = document.getElementById('tutorInput');
      if (!inp || !inp.value.trim()) return;
      const text = inp.value.trim();
      const container = document.getElementById('tutorMessages');
      appState.aiChat.msgs.push({ from: 'user', text });
      inp.value = '';
      if (container) {
        const div = document.createElement('div');
        div.className = 'flex justify-end';
        div.innerHTML = `<div class="bg-indigo-600 text-white text-sm px-3 py-2 rounded-2xl rounded-tr-none max-w-[85%]">${esc(text)}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
      }
      setTimeout(() => {
        const lower = text.toLowerCase();
        let reply = "That's an interesting question! Try breaking it into smaller steps and reviewing your notes. Need a practice worksheet?";
        if (lower.includes('photo')) reply = "Photosynthesis is the process where plants use sunlight, water, and CO2 to create glucose and oxygen. Chloroplasts in leaf cells are the main site for this reaction.";
        else if (lower.includes('solve') || lower.includes('equation') || lower.includes('x')) reply = "To solve linear equations, isolate the variable. Subtract constants first, then divide by the coefficient. Would you like a step-by-step demo?";
        else if (lower.includes('capital') || lower.includes('nigeria')) reply = "Abuja is the capital city of Nigeria. It became the official capital in 1991, replacing Lagos.";
        appState.aiChat.msgs.push({ from: 'ai', text: reply });
        if (container) {
          const div = document.createElement('div');
          div.className = 'flex justify-start';
          div.innerHTML = `<div class="bg-slate-100 text-slate-800 text-sm px-3 py-2 rounded-2xl rounded-tl-none max-w-[85%]">${esc(reply)}</div>`;
          container.appendChild(div);
          container.scrollTop = container.scrollHeight;
        }
      }, 1200);
    }

    // Live Class
    function toggleRecording() {
      appState.liveClass.recording = !appState.liveClass.recording;
      render();
    }
    function endClass() {
      setView('dashboard');
      showToast('Class ended and recording saved');
    }
    function sendLiveMsg() {
      const inp = document.getElementById('liveMsgInput');
      if (!inp || !inp.value.trim()) return;
      const text = inp.value.trim();
      appState.liveClass.msgs.push({ sender: appState.user.name || 'You', text });
      inp.value = '';
      const box = document.getElementById('liveChatBox');
      if (box) {
        const div = document.createElement('div');
        div.className = 'text-sm mb-2';
        div.innerHTML = `<span class="font-semibold text-indigo-700">${esc(appState.user.name)}:</span> <span class="text-slate-700">${esc(text)}</span>`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
      }
    }