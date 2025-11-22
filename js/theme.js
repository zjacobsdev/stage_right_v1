(function(){
  const key = 'practicepal_theme';
  const btns = document.querySelectorAll('#themeToggle');
  function applyTheme(t){
    if(t==='light') document.documentElement.classList.add('theme-light');
    else document.documentElement.classList.remove('theme-light');
    localStorage.setItem(key, t);
    updateButtons(t);
  }
  function updateButtons(t){
    btns.forEach(b=>{ b.textContent = (t==='light') ? '☀️' : '🌙'; });
  }
  function init(){
    const saved = localStorage.getItem(key) || 'dark';
    applyTheme(saved);
    btns.forEach(b=> b.addEventListener('click', ()=>{ const cur = document.documentElement.classList.contains('theme-light') ? 'light' : 'dark'; applyTheme(cur==='light' ? 'dark' : 'light'); }));
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
