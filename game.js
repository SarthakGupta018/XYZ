import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

// IRON CLASH — first playable prototype. Original placeholder characters and combat.
const stage = document.querySelector('#stage');
const $ = (id) => document.getElementById(id);
const playerHealthEl = $('player-health');
const enemyHealthEl = $('enemy-health');
const message = $('message');
const helpOverlay = $('help-overlay');
const pauseOverlay = $('pause-overlay');
const resultOverlay = $('result-overlay');
const keys = new Set();
let paused = false;
let finished = false;
let started = false;
let selectedLevel = 1;
let helpReturnState = 'welcome';
let lastTime = 0;
let elapsed = 0;
let hitStop = 0;
const scoreStorageKey = 'iron-clash-points';
function loadScore(){
  try{
    const saved=Number(window.localStorage.getItem(scoreStorageKey));
    return Number.isSafeInteger(saved)&&saved>=0?saved:0;
  }catch(error){
    console.warn('Unable to load the saved score.',error);
    return 0;
  }
}
let score=loadScore();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b1220');
scene.fog = new THREE.Fog('#0b1220', 14, 32);
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
camera.position.set(0, 6.8, 12.5);
camera.lookAt(0, 1.4, 0);
const mobilePerformance = window.matchMedia('(max-width: 720px)').matches || (navigator.deviceMemory || 8) <= 4;
const renderer = new THREE.WebGLRenderer({ antialias: !mobilePerformance, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobilePerformance ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xa8d9ff, 0x1a1224, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-5, 9, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.setScalar(mobilePerformance ? 512 : 1024);
keyLight.shadow.camera.left = -10; keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10; keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x21e8e0, 22, 12); cyanLight.position.set(-5, 3, -2); scene.add(cyanLight);
const redLight = new THREE.PointLight(0xff355a, 20, 12); redLight.position.set(5, 3, -1); scene.add(redLight);

const floorMat = new THREE.MeshStandardMaterial({ color: '#141f2d', roughness: 0.62, metalness: 0.45 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(24, 24, 0x1a6b78, 0x26394c); grid.position.y = 0.005; scene.add(grid);
const arenaRingMat = new THREE.MeshStandardMaterial({ color: '#15505c', emissive: '#14a9ad', emissiveIntensity: 1.15, metalness: .7, roughness: .3 });
for (const radius of [3.15, 4.35]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .025, 6, 80), arenaRingMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = .018;
  scene.add(ring);
}
function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
const edgeMat = new THREE.MeshStandardMaterial({color:'#1a3445',emissive:'#0c5860',emissiveIntensity:1.5,metalness:.7,roughness:.3});
for (const z of [-4.7, 4.7]) { box(12,.12,.12,edgeMat,0,.12,z); }
for (const x of [-6,6]) { box(.12,.12,9.4,edgeMat,x,.12,0); }
const backWallMat = new THREE.MeshStandardMaterial({color:'#101a29',metalness:.6,roughness:.45});
box(13,3,.28,backWallMat,0,1.4,-5.1);
const neonC = new THREE.MeshStandardMaterial({color:'#37e8df',emissive:'#20c8c5',emissiveIntensity:2.4});
const neonR = new THREE.MeshStandardMaterial({color:'#ff4868',emissive:'#e52b50',emissiveIntensity:2.4});
box(8,.035,.04,neonC,0,2.6,-4.93);
box(3,.035,.04,neonR,0,2.35,-4.93);
// Stylized arena pillars and floating light bars.
for(let i=0;i<7;i++){
  const x=-5.4+i*1.8;
  box(.035,1.9,.05,i%2?neonC:neonR,x,1.1,-4.9);
  box(.75,.025,.05,i%2?neonR:neonC,x,2.15,-4.9);
}

function material(color, metalness=.2, roughness=.48, emissive=null){return new THREE.MeshStandardMaterial({color,metalness,roughness,...(emissive?{emissive,emissiveIntensity:.55}:{})});}
function capsuleLike(parent, radius, length, mat, x,y,z){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,4,8),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function makeFighter({name,color,dark,accent, x, player}){
  const root=new THREE.Group();root.position.set(x,0,0);scene.add(root);
  const body=new THREE.Group();body.position.y=0;root.add(body);
  const main=material(color,.48,.3); const shade=material(dark,.62,.32); const glow=material(accent,.35,.28,accent);
  const skin=material(player?'#c78f6c':'#9e6d58',.08,.72);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.72,5,10),main);torso.position.y=1.43;torso.castShadow=true;body.add(torso);
  const chest=new THREE.Mesh(new THREE.BoxGeometry(.62,.19,.22),glow);chest.position.set(0,1.62,.31);body.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.27,16,12),skin);head.scale.set(.88,1.1,.9);head.position.y=2.17;head.castShadow=true;body.add(head);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.285,12,8),shade);hair.scale.set(1, .58, .98);hair.position.set(0,2.34,0);body.add(hair);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.34,.075,.08),glow);visor.position.set(0,2.2,.235);body.add(visor);
  const shoulderL=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),shade);shoulderL.position.set(-.43,1.77,0);body.add(shoulderL);
  const shoulderR=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),shade);shoulderR.position.set(.43,1.77,0);body.add(shoulderR);
  const armorL=new THREE.Mesh(new THREE.SphereGeometry(.235,12,8),glow);armorL.scale.set(1,.72,.72);armorL.position.set(-.43,1.82,.045);body.add(armorL);
  const armorR=armorL.clone();armorR.position.x=.43;body.add(armorR);
  const chestPlate=new THREE.Mesh(new THREE.BoxGeometry(.46,.22,.07),shade);chestPlate.position.set(0,1.52,.38);body.add(chestPlate);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.55,.11,.28),glow);belt.position.set(0,.98,.08);body.add(belt);
  const armL=capsuleLike(body,.13,.42,main,-.48,1.43,.04);armL.rotation.z=.2;
  const armR=capsuleLike(body,.13,.42,main,.48,1.43,.04);armR.rotation.z=-.2;
  const fistL=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),glow);fistL.position.set(-.5,1.16,.09);body.add(fistL);
  const fistR=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),glow);fistR.position.set(.5,1.16,.09);body.add(fistR);
  const legL=capsuleLike(body,.16,.52,shade,-.2,.48,0);legL.rotation.z=-.04;
  const legR=capsuleLike(body,.16,.52,shade,.2,.48,0);legR.rotation.z=.04;
  const bootL=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.42),glow);bootL.position.set(-.2,.13,.1);body.add(bootL);
  const bootR=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.42),glow);bootR.position.set(.2,.13,.1);body.add(bootR);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.8,24),new THREE.MeshBasicMaterial({color:'#02050a',transparent:true,opacity:.5}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;root.add(shadow);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.025,6,40),glow);ring.rotation.x=Math.PI/2;ring.position.y=.04;root.add(ring);
  return {name,root,body,torso,head,armL,armR,fistL,fistR,legL,legR,bootL,bootR,ring,player,hp:100,maxHp:100,guard:false,attack:null,attackTime:0,attackDone:false,stun:0,cooldown:0,walk:0,baseX:x,jumpHeight:0,jumpVelocity:0,jumping:false};
}
const player=makeFighter({name:'Vanguard',color:'#1e5666',dark:'#142633',accent:'#38e6dc',x:-2.25,player:true});
const enemy=makeFighter({name:'Wraith',color:'#612a3b',dark:'#281a2a',accent:'#ff4b66',x:2.25,player:false});

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=()=>Math.abs(enemy.root.position.x-player.root.position.x);
function updateHealth(){
  playerHealthEl.style.width=`${player.hp/player.maxHp*100}%`;enemyHealthEl.style.width=`${enemy.hp/enemy.maxHp*100}%`;
  $('player-health-text').textContent=`${Math.ceil(player.hp)} / ${player.maxHp}`;$('enemy-health-text').textContent=`${Math.ceil(enemy.hp)} / ${enemy.maxHp}`;
  $('player-power').textContent=player.jumping?'AIRBORNE':player.cooldown>0?'CHARGING':'READY';
  $('distance-label').textContent=`DISTANCE: ${distance().toFixed(1)}M`;
}
function updateScore(){ $('score').textContent=String(score); }
function setMessage(title,sub='') {message.innerHTML=`<strong>${title}</strong><span>${sub}</span>`;message.classList.remove('hidden');}
function hideMessage(){message.classList.add('hidden');}
function setLevel(level){selectedLevel=clamp(Number(level)||1,1,10);$('level-select').value=String(selectedLevel);$('intro-level-select').value=String(selectedLevel);$('start-easy').textContent=`START LEVEL ${selectedLevel}`;$('start-normal').textContent='PRACTICE LEVEL 1';enemy.maxHp=100+(selectedLevel-1)*6;if(!started||finished){enemy.hp=enemy.maxHp;updateHealth();}}
function startGame(level=selectedLevel){if(!started){setLevel(level);started=true;$('level-select').disabled=true;$('intro-level-select').disabled=true;helpOverlay.classList.add('hidden');setMessage('FIGHT!','');setTimeout(()=>{if(started&&!finished)hideMessage();},650);}}
function showHelp(){if(helpOverlay.classList.contains('hidden')){helpReturnState=finished?'finished':paused?'paused':started?'running':'welcome';if(helpReturnState==='running'){paused=true;keys.clear();}pauseOverlay.classList.add('hidden');$('start-easy').textContent=helpReturnState==='welcome'?`START LEVEL ${selectedLevel}`:'CONTINUE';$('start-normal').classList.toggle('hidden',helpReturnState!=='welcome');helpOverlay.classList.remove('hidden');}}
function closeHelp(level=selectedLevel){helpOverlay.classList.add('hidden');if(helpReturnState==='welcome')startGame(level);else if(helpReturnState==='running')paused=false;else if(helpReturnState==='paused')pauseOverlay.classList.remove('hidden');}
function beginAttack(f, type){if(paused||finished||f.stun>0||f.cooldown>0||f.attack)return;startGame();f.guard=false;f.attack=type;f.attackTime=0;f.attackDone=false;const enemyCooldownScale=1.5-(selectedLevel-1)*.1;f.cooldown=(type==='burst'?.95:type==='kick'?.7:.43)*(f===enemy?enemyCooldownScale:1);}
function jumpPlayer(){if(paused||finished||player.attack||player.guard||player.jumping||player.jumpHeight>0||!helpOverlay.classList.contains('hidden'))return;startGame();player.jumping=true;player.jumpVelocity=5.1;}
function resetFighter(f,x){f.root.position.set(x,0,0);f.root.rotation.set(0,0,0);f.hp=f.maxHp;f.guard=false;f.attack=null;f.attackTime=0;f.attackDone=false;f.cooldown=0;f.stun=0;f.walk=0;f.jumpHeight=0;f.jumpVelocity=0;f.jumping=false;f.body.position.set(0,0,0);}
function resetGame(){resetFighter(player,-2.25);setLevel(selectedLevel);resetFighter(enemy,2.25);paused=false;finished=false;started=false;$('level-select').disabled=false;$('intro-level-select').disabled=false;helpReturnState='welcome';elapsed=0;hitStop=0;keys.clear();pauseOverlay.classList.add('hidden');resultOverlay.classList.add('hidden');$('start-normal').classList.remove('hidden');helpOverlay.classList.remove('hidden');setMessage('READY?','Choose a level or tap an attack to begin');updateHealth();}
function endGame(winner){if(finished)return;finished=true;$('level-select').disabled=false;$('intro-level-select').disabled=false;keys.clear();if(winner==='player'){score+=1;updateScore();try{window.localStorage.setItem(scoreStorageKey,String(score));}catch(error){console.warn('Unable to save the score.',error);}}$('result-title').textContent=winner==='player'?'VICTORY':'DEFEAT';$('result-title').style.color=winner==='player'?'#38e6dc':'#ff4b66';$('result-copy').textContent=winner==='player'?`Level ${selectedLevel} cleared! You earned 1 point. Your total is ${score}.`:`Level ${selectedLevel} defeated you. Choose a lower level or try again.`;resultOverlay.classList.remove('hidden');}
function resolveHit(attacker, defender, damage, reach){if(attacker.attackDone||attacker.attackTime<.16||attacker.attackTime>.32)return;const jumpKick=attacker===player&&attacker.jumpHeight>.3&&attacker.attack==='kick';if(distance()>(jumpKick?2.35:reach))return;attacker.attackDone=true;const blocked=defender.guard;const baseDamage=jumpKick?18:damage;const adjustedDamage=attacker===enemy?Math.ceil(baseDamage*(.6+(selectedLevel-1)*.044)):baseDamage;const actual=blocked?Math.ceil(adjustedDamage*.18):adjustedDamage;defender.hp=Math.max(0,defender.hp-actual);defender.stun=blocked?.08:.22;defender.root.position.x+= (attacker.root.position.x<defender.root.position.x?1:-1)*(blocked?.08:.28);hitStop=.055;if(!blocked){setMessage(jumpKick?'JUMP KICK!':attacker.attack==='burst'?'BURST HIT!':attacker.attack==='kick'?'CLEAN KICK!':'HIT!','');setTimeout(()=>{if(!finished&&started)hideMessage();},360);}updateHealth();if(defender.hp<=0)endGame(attacker===player?'player':'enemy');}
function animateFighter(f,dt){f.walk+=dt*9;f.cooldown=Math.max(0,f.cooldown-dt);f.stun=Math.max(0,f.stun-dt);if(f.jumping){f.jumpVelocity-=15*dt;f.jumpHeight=Math.max(0,f.jumpHeight+f.jumpVelocity*dt);if(f.jumpHeight===0){f.jumpVelocity=0;f.jumping=false;}}if(f.attack){f.attackTime+=dt;const t=f.attackTime;f.body.rotation.x=0;f.armL.rotation.z=.2;f.armR.rotation.z=-.2;f.legL.rotation.x=0;f.legR.rotation.x=0;
    if(f.attack==='punch'){const swing=Math.sin(Math.min(1,t/.25)*Math.PI);f.armR.rotation.z=-.2-1.4*swing;f.armR.rotation.x=-.75*swing;f.fistR.position.z=.09+.42*swing;resolveHit(f,f===player?enemy:player,8,1.65);}
    if(f.attack==='kick'){const swing=Math.sin(Math.min(1,t/.4)*Math.PI);f.legR.rotation.x=-1.15*swing;f.body.rotation.x=.12*swing;resolveHit(f,f===player?enemy:player,13,1.9);}
    if(f.attack==='burst'){const swing=Math.sin(Math.min(1,t/.42)*Math.PI);f.armL.rotation.z=.2+1.2*swing;f.armR.rotation.z=-.2-1.2*swing;f.body.rotation.x=-.22*swing;resolveHit(f,f===player?enemy:player,20,2.15);}
    if(t>(f.attack==='punch'?.34:f.attack==='kick'?.52:.55)){f.attack=null;f.attackTime=0;f.attackDone=false;f.body.rotation.set(0,0,0);f.fistR.position.z=.09;}
  } else {f.body.rotation.z=f.guard?0:Math.sin(f.walk*.5)*.018;f.armR.rotation.z=f.guard?-.75:-.2;f.armL.rotation.z=f.guard?.75:.2;f.fistR.position.z=.09;f.legL.rotation.x=Math.sin(f.walk)*.12;f.legR.rotation.x=-Math.sin(f.walk)*.12;}
  f.body.position.y=f.jumpHeight+(f.jumping?0:Math.sin(f.walk)*.025);
  if(f.guard&&!f.attack){f.armL.rotation.z=.8;f.armR.rotation.z=-.8;f.armL.rotation.x=-.55;f.armR.rotation.x=-.55;}else{f.armL.rotation.x=0;f.armR.rotation.x=0;}
  f.ring.rotation.z+=dt*.5;
}
function updatePlayer(dt){if(player.stun>0)return;const speed=keys.has('shift')?4.6:3.4;let move=0,depth=0;if(keys.has('a'))move-=1;if(keys.has('d'))move+=1;if(keys.has('w'))depth-=1;if(keys.has('s'))depth+=1;if(!player.attack&&!player.guard){player.root.position.x+=move*speed*dt;player.root.position.z+=depth*speed*.55*dt;}player.root.position.x=clamp(player.root.position.x,-4.7,4.7);player.root.position.z=clamp(player.root.position.z,-1.7,2.4);player.guard=keys.has('l')&&!player.attack;if((keys.has('j'))&&!player.attack)beginAttack(player,'punch');if(keys.has('k')&&!player.attack)beginAttack(player,'kick');if(keys.has(' ')&&!player.attack)beginAttack(player,'burst');}
function updateAI(dt){if(!started||finished||paused||enemy.stun>0)return;const dx=player.root.position.x-enemy.root.position.x;const dz=player.root.position.z-enemy.root.position.z;const dist=Math.hypot(dx,dz);enemy.guard=false;if(!enemy.attack){const attackDistance=1.35+(selectedLevel-1)*.02;const speed=1.4+(selectedLevel-1)*.1;if(dist>attackDistance){enemy.root.position.x+=Math.sign(dx)*Math.min(Math.abs(dx),attackDistance)*speed*dt;enemy.root.position.z+=Math.sign(dz)*Math.min(Math.abs(dz),.7)*.8*dt;}else if(enemy.cooldown<=0){const r=Math.random();if(player.attack&&Math.random()<Math.max(.15,.45-(selectedLevel-1)*.025))enemy.guard=true;else beginAttack(enemy,r<.48?'punch':r<.84?'kick':'burst');}}enemy.root.position.x=clamp(enemy.root.position.x,-4.7,4.7);enemy.root.position.z=clamp(enemy.root.position.z,-1.7,2.4);}
function orientFighters(){const dx=enemy.root.position.x-player.root.position.x;player.root.rotation.y=dx>=0?Math.PI/2:-Math.PI/2;enemy.root.rotation.y=dx>=0?-Math.PI/2:Math.PI/2;}
function updateCamera(dt){const mid=(player.root.position.x+enemy.root.position.x)/2;const targetX=clamp(mid*.22,-.8,.8);camera.position.x+=(targetX-camera.position.x)*Math.min(1,dt*2.5);camera.position.y+=(6.6-camera.position.y)*Math.min(1,dt*2);camera.lookAt(mid*.18,1.35,-.2);}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function frame(now){requestAnimationFrame(frame);let dt=Math.min((now-lastTime)/1000||0,.035);lastTime=now;if(paused)return;if(hitStop>0){hitStop-=dt;dt*=.18;}elapsed+=dt;if(!finished){updatePlayer(dt);updateAI(dt);orientFighters();animateFighter(player,dt);animateFighter(enemy,dt);updateCamera(dt);updateHealth();}renderer.render(scene,camera);}
requestAnimationFrame(frame);
window.addEventListener('keydown',(e)=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='escape'&&!helpOverlay.classList.contains('hidden')){if(helpReturnState!=='welcome')closeHelp();return;}if(k==='escape'||k==='p'){togglePause();return;}if(k==='u'&&!e.repeat){jumpPlayer();return;}keys.add(k);});
window.addEventListener('keyup',(e)=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
function togglePause(){if(finished)return;paused=!paused;pauseOverlay.classList.toggle('hidden',!paused);if(paused)keys.clear();}
$('pause-btn').addEventListener('click',togglePause);$('resume-btn').addEventListener('click',togglePause);$('restart-btn').addEventListener('click',resetGame);$('reset-btn').addEventListener('click',resetGame);$('help-btn').addEventListener('click',showHelp);$('level-select').addEventListener('change',(event)=>setLevel(event.target.value));$('intro-level-select').addEventListener('change',(event)=>setLevel(event.target.value));$('start-easy').addEventListener('click',()=>closeHelp(selectedLevel));$('start-normal').addEventListener('click',()=>closeHelp(1));document.querySelector('[data-action="jump"]').addEventListener('click',jumpPlayer);
for(const btn of document.querySelectorAll('[data-key]')){const key=btn.dataset.key;const down=(e)=>{e.preventDefault();keys.add(key);};const up=(e)=>{e.preventDefault();keys.delete(key);};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);}
updateScore();
resetGame();
