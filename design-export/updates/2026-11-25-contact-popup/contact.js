/* FORREST — кнопка «Зв'язатися» + попап «Передзвоніть мені». Vanilla JS, без залежностей.
   Відкрити попап: будь-який елемент з [data-fc-open] або window.ForrestCallback.open()
   Заявка: подія 'forrest:lead' на document (detail: {name, phone, source}) — підключіть свій CRM/бекенд тут або в onLead. */
(function(){
  var pop=document.getElementById('callback');if(!pop)return;
  var form=pop.querySelector('[data-fc-form]'),step=pop.querySelector('[data-fc-step]'),done=pop.querySelector('[data-fc-done]'),err=pop.querySelector('[data-fc-err]'),lastFocus=null;
  function setErr(on){err.hidden=!on;form.phone.setAttribute('aria-invalid',on?'true':'false');}
  function open(e){if(e)e.preventDefault();lastFocus=document.activeElement;form.reset();setErr(false);step.hidden=false;done.hidden=true;pop.hidden=false;document.documentElement.style.overflow='hidden';setTimeout(function(){form.name.focus();},50);}
  function close(){pop.hidden=true;document.documentElement.style.overflow='';if(lastFocus&&lastFocus.focus)lastFocus.focus();}
  document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-fc-open]');if(t)open(e);});
  pop.querySelector('[data-fc-close]').addEventListener('click',close);
  pop.addEventListener('click',function(e){if(e.target===pop)close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pop.hidden)close();});
  form.phone.addEventListener('input',function(){if(!err.hidden)setErr(false);});
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var digits=(form.phone.value||'').replace(/\D/g,'');
    if(digits.length<9){setErr(true);form.phone.focus();return;}
    var lead={name:form.name.value.trim(),phone:form.phone.value.trim(),source:'header-contact'};
    document.dispatchEvent(new CustomEvent('forrest:lead',{detail:lead}));
    if(typeof window.ForrestCallback.onLead==='function')window.ForrestCallback.onLead(lead);
    step.hidden=true;done.hidden=false;
  });
  window.ForrestCallback={open:open,close:close,onLead:null};
})();
