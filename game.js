import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
(()=>{'use strict';
const root=document.getElementById('gameview'), logEl=document.getElementById('log');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9ba99a);scene.fog=new THREE.Fog(0x9ba99a,42,105);
const camera=new THREE.PerspectiveCamera(48,1,.1,220);camera.position.set(0,26,34);camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe7f2ff,0x4a553c,2.0));
const sun=new THREE.DirectionalLight(0xfff0d4,3);sun.position.set(-18,32,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const mat=(color,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness});
const terrainMat=mat(0x65765a), darkMat=mat(0x313b32), blueMat=mat(0x3d83ba), blueDark=mat(0x244a62), redMat=mat(0xb74b3c), metal=mat(0x343a35), trackMat=mat(0x202823), skin=mat(0xc2a17c), grassMat=mat(0x81906a);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(84,64,32,24),terrainMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(84,42,0x839078,0x75836a);grid.position.y=.025;scene.add(grid);
function box(parent,w,h,d,material,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cylinder(parent,rt,rb,h,material,x,y,z,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
function tree(x,z,s=1){const g=new THREE.Group();cylinder(g,.12*s,.2*s,1.3*s,mat(0x554936),0,.65*s,0,7);const c=new THREE.Mesh(new THREE.ConeGeometry(.65*s,1.8*s,7),mat(0x435941));c.position.y=1.75*s;c.castShadow=true;g.add(c);g.position.set(x,0,z);scene.add(g)}
for(let i=0;i<55;i++){let x=(Math.random()-.5)*78,z=(Math.random()-.5)*57;if(Math.abs(x)<10&&Math.abs(z)<9)continue;tree(x,z,.65+Math.random()*.65)}
// road, stream and bridge
const road=new THREE.Mesh(new THREE.PlaneGeometry(84,5),mat(0x55584c));road.rotation.x=-Math.PI/2;road.position.set(0,.04,-1);scene.add(road);
const stream=new THREE.Mesh(new THREE.PlaneGeometry(84,3.2),mat(0x547f8a,.45));stream.rotation.x=-Math.PI/2;stream.position.set(0,.07,2.5);scene.add(stream);
box(scene,9,.24,5,mat(0x8a8978),0,.18,2.5);
for(let x=-4;x<=4;x+=1.5)box(scene,.12,.4,.12,mat(0xb4ad94),x,.42,.2);
function building(x,z,w,d){let b=box(scene,w,1.8,d,mat(0x77796e),x,.9,z);box(scene,w*.45,.15,d*.45,mat(0x4d554d),x,1.9,z);for(let i=-1;i<=1;i++)box(scene,.18,.4,.08,mat(0x343b37),x+i*w*.22,1,z-d/2-.05)}
building(-14,-8,5,4);building(13,10,5,4);building(18,-11,4,3);building(-22,13,5,4);
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const units=[], effects=[], sectors=[], selection=new Set();
let cash=650,lossPoints=0,elapsed=0,paused=false,gameOver=false,order='move',last=0,spawnClock=0,aircraft=null;
const unitCost={infantry:120,tank:250,artillery:280,apc:180};
const unitNames={infantry:'Мотопехота',tank:'Основной танк',artillery:'Артиллерия',apc:'БТР'};
function addLog(s){logEl.textContent='[HQ] '+s+'\n'+logEl.textContent.split('\n').slice(0,3).join('\n')}
function makeUnit(type,x,z,team='blue'){
 const g=new THREE.Group();const friendly=team==='blue';const color=friendly?blueMat:redMat;let hp=type==='tank'?180:type==='artillery'?85:type==='apc'?125:65;
 if(type==='tank'||type==='enemyTank'){
  box(g,2.25,.6,3.25,color,0,.72,0);box(g,2.45,.35,3.1,trackMat,0,.45,0);box(g,.9,.48,1.15,blueDark===color?color:(friendly?blueDark:mat(0x682c28)),0,1.15,-.2);cylinder(g,.24,.24,2.1,metal,0,1.18,-1.25,10).rotation.x=Math.PI/2;
  for(let side of [-1,1])for(let zz=-1.1;zz<=1.1;zz+=.55)cylinder(g,.24,.24,.13,metal,side*1.13,.48,zz,10).rotation.z=Math.PI/2;
  type='tank';hp=180;
 }else if(type==='apc'){
  box(g,1.7,.75,2.8,color,0,.72,0);box(g,1.2,.35,1.1,friendly?blueDark:mat(0x682c28),0,1.2,-.2);
  for(let side of [-1,1])for(let zz=-.9;zz<=.9;zz+=.6)cylinder(g,.2,.2,.12,trackMat,side*.87,.48,zz,8).rotation.z=Math.PI/2;
 }else if(type==='artillery'){
  box(g,1.8,.5,2.5,color,0,.55,0);box(g,1.05,.3,1.1,metal,0,.9,.1);cylinder(g,.12,.12,2.5,metal,0,1.05,-1.15,10).rotation.x=Math.PI/2;
 }else{
  cylinder(g,.28,.28,.9,friendly?blueDark:mat(0x682c28),0,.62,0,9);const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),skin);head.position.y=1.2;g.add(head);box(g,.55,.45,.35,color,0,.68,0);
  box(g,.08,.08,.9,metal,0,.9,-.48);
 }
 g.position.set(x,0,z);scene.add(g);
 const u={id:Math.random(),type,team,g,hp,maxHp:hp,speed:type==='tank'?3.1:type==='artillery'?2.2:type==='apc'?3.5:4.2,range:type==='artillery'?16:type==='tank'?9:type==='apc'?7:6,damage:type==='artillery'?27:type==='tank'?24:type==='apc'?12:8,target:null,fire:0,dead:false,moveTarget:null};
 units.push(u);return u;
}
function sector(x,z,name){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(2.2,.09,8,36),mat(0x7ce58b));ring.rotation.x=Math.PI/2;ring.position.y=.12;g.add(ring);cylinder(g,.05,.05,2,mat(0xd4d7c8),0,1,0,8);const flag=box(g,.65,.42,.06,mat(0x7ce58b),.35,1.65,0);g.position.set(x,0,z);scene.add(g);sectors.push({x,z,name,owner:0,progress:0,g,flag})}
sector(-17,0,'МОСТ');sector(17,-17,'ВЫСОТА 204');
makeUnit('tank',-8,8);makeUnit('infantry',-11,10);makeUnit('infantry',-9,12);makeUnit('artillery',-14,8);makeUnit('apc',-6,11);
for(let i=0;i<5;i++)makeUnit(i===0?'enemyTank':'infantry',10+Math.random()*8,-4+Math.random()*15,'red');
function updateCash(){document.getElementById('cash').textContent=cash+' сомони';document.getElementById('lossPoints').textContent=lossPoints+' очков'}
function refreshSelection(){document.getElementById('selectedCount').textContent=selection.size+' выбрано';const u=[...selection][0];document.getElementById('unitstats').textContent=u?unitNames[u.type]+' · HP '+Math.ceil(u.hp)+'/'+u.maxHp+' · '+(u.team==='blue'?'СВОЙ':'ВРАГ'):'Подразделение не выбрано'}
function removeUnit(u){if(u.dead)return;u.dead=true;scene.remove(u.g);const i=units.indexOf(u);if(i>=0)units.splice(i,1);selection.delete(u);if(u.team==='blue'){cash+=35;lossPoints++;updateCash();addLog(unitNames[u.type]+' потерян. +35 SM за эвакуацию/замену.')}else addLog('Цель уничтожена.');refreshSelection()}
function blast(x,z){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.55,8,8),new THREE.MeshBasicMaterial({color:0xffb05a,transparent:true,opacity:.9}));mesh.position.set(x,.5,z);scene.add(mesh);effects.push({mesh,t:0})}
function buy(type){const price=unitCost[type];if(cash<price){addLog('Недостаточно сомони для '+unitNames[type]+'.');return}cash-=price;updateCash();makeUnit(type,-5+Math.random()*4,13+Math.random()*3);addLog('Подкрепление прибыло: '+unitNames[type]+'.')}
function callAirdrop(){if(aircraft)return;if(cash<450){addLog('Воздушный мост стоит 450 сомони. Недостаточно средств.');return}cash-=450;updateCash();aircraft={t:0};addLog('Запрос принят. Тяжёлый транспортный самолёт на подходе!')}
document.querySelectorAll('[data-unit]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.unit)));
document.getElementById('airdrop').addEventListener('click',callAirdrop);
document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>{order=b.dataset.order;document.querySelectorAll('[data-order]').forEach(x=>x.classList.toggle('active',x===b));document.getElementById('hint').textContent=({move:'Выбери отряд и точку назначения.',attack:'Выбери своих, затем цель противника.',capture:'Отправь пехоту или броню к зелёному сектору.',bombard:'Выбери артиллерию, затем точку удара.'})[order]}));
document.getElementById('pause').addEventListener('click',()=>{paused=!paused;document.getElementById('pause').textContent=paused?'▶ ПРОДОЛЖИТЬ':'Ⅱ ПАУЗА'});
function screenToGround(e){const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const p=new THREE.Vector3();raycaster.ray.intersectPlane(groundPlane,p);return p}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=screenToGround(e);raycaster.setFromCamera(pointer,camera);const meshes=[];units.forEach(u=>{u.g.traverse(o=>{if(o.isMesh){o.userData.unit=u;meshes.push(o)}})});const hits=raycaster.intersectObjects(meshes,false);if(hits.length&&hits[0].object.userData.unit){const u=hits[0].object.userData.unit;if(u.team==='blue'){if(!e.shiftKey)selection.clear();selection.add(u);refreshSelection();return}if(order==='attack'){selection.forEach(a=>a.target=u);addLog('Приказ: атаковать вражескую цель.');return}}
 if(selection.size){selection.forEach(u=>{if(order==='bombard'&&u.type==='artillery'){u.moveTarget=null;u.bombard={x:p.x,z:p.z};addLog('Артиллерия готовит залп по указанным координатам.')}else{u.moveTarget={x:p.x,z:p.z};if(order==='attack'){const enemy=units.filter(v=>v.team==='red').sort((a,b)=>a.g.position.distanceTo(p)-b.g.position.distanceTo(p))[0];if(enemy)u.target=enemy}}});if(order==='capture')addLog('Отряд выдвигается к сектору.');else if(order==='move')addLog('Приказ движения принят.')}
});
let dragging=false,prev={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2){dragging=true;prev={x:e.clientX,y:e.clientY}}});window.addEventListener('pointerup',()=>dragging=false);window.addEventListener('pointermove',e=>{if(dragging){camera.position.x-=(e.clientX-prev.x)*.045;camera.position.z+=(e.clientY-prev.y)*.045;camera.lookAt(camera.position.x*.4,0,0);prev={x:e.clientX,y:e.clientY}}});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('wheel',e=>{camera.position.multiplyScalar(e.deltaY>0?1.07:.93);camera.position.y=Math.max(12,Math.min(55,camera.position.y));camera.lookAt(0,0,0)},{passive:true});
function update(dt){elapsed+=dt;spawnClock+=dt;document.getElementById('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
 if(spawnClock>28&&units.filter(u=>u.team==='red').length<7){spawnClock=0;makeUnit(Math.random()<.22?'enemyTank':'infantry',20+Math.random()*8,-20+Math.random()*22,'red');addLog('Разведка: замечено подкрепление противника.')}
 for(const u of [...units]){u.fire-=dt;
  if(u.moveTarget){const dx=u.moveTarget.x-u.g.position.x,dz=u.moveTarget.z-u.g.position.z,d=Math.hypot(dx,dz);if(d>.55){u.g.position.x+=dx/d*u.speed*dt;u.g.position.z+=dz/d*u.speed*dt;u.g.rotation.y=Math.atan2(dx,dz)}else u.moveTarget=null}
  let enemies=units.filter(v=>v.team!==u.team&&!v.dead);if(!u.target||u.target.dead||!enemies.includes(u.target))u.target=enemies.sort((a,b)=>u.g.position.distanceTo(a.g.position)-u.g.position.distanceTo(b.g.position))[0]||null;
  if(u.target&&u.g.position.distanceTo(u.target.g.position)<u.range){if(u.fire<=0){u.fire=u.type==='artillery'?2.8:1.1;const target=u.target;target.hp-=u.damage;blast(target.g.position.x,target.g.position.z);if(target.hp<=0)removeUnit(target)}}
  if(u.bombard){u.fire-=dt;if(u.fire<=0){u.fire=3.2;blast(u.bombard.x,u.bombard.z);units.filter(v=>v.team==='red'&&Math.hypot(v.g.position.x-u.bombard.x,v.g.position.z-u.bombard.z)<4.8).forEach(v=>{v.hp-=28;if(v.hp<=0)removeUnit(v)})}}
 }
 sectors.forEach(s=>{const nearby=units.filter(u=>u.team==='blue'&&Math.hypot(u.g.position.x-s.x,u.g.position.z-s.z)<4.4);if(nearby.length){s.progress=Math.min(100,s.progress+dt*8);if(s.progress>=100&&s.owner!==1){s.owner=1;s.flag.material=mat(0x68c9ff);addLog('Сектор '+s.name+' захвачен! +100 сомони.');cash+=100;updateCash()}}});
 document.getElementById('objective').textContent='СЕКТОРА: '+sectors.filter(s=>s.owner===1).length+'/2';
 if(units.filter(u=>u.team==='blue').length===0){gameOver=true;document.getElementById('status').textContent='ПОРАЖЕНИЕ';addLog('Все подразделения потеряны. Перезапусти страницу для новой операции.')}
 if(sectors.every(s=>s.owner===1)&&units.filter(u=>u.team==='red').length===0){gameOver=true;document.getElementById('status').textContent='ПОБЕДА';addLog('Операция выполнена!')}
 if(aircraft){aircraft.t+=dt;const t=aircraft.t;const planeX=-42+t*12;const planeZ=-8; if(!aircraft.mesh){const g=new THREE.Group();const body=box(g,1.1,.8,4,mat(0xddd8c6),0,0,0);box(g,7,.16,1.2,mat(0xbfc4b9),0,.1,0);box(g,.2,1.8,.8,mat(0xbfc4b9),0,.2,1.4);aircraft.mesh=g;scene.add(g)}aircraft.mesh.position.set(planeX,11,planeZ);aircraft.mesh.rotation.y=Math.PI/2;if(t>7){scene.remove(aircraft.mesh);aircraft=null;makeUnit('tank',-1,4);makeUnit('infantry',1,5);makeUnit('infantry',2,4);addLog('Воздушный мост завершён: танк и два отделения высажены.')}} 
 effects.forEach(e=>{e.t+=dt;e.mesh.scale.setScalar(1+e.t*3);e.mesh.material.opacity=Math.max(0,1-e.t*1.8);if(e.t>0.6){scene.remove(e.mesh);e.dead=true}});for(let i=effects.length-1;i>=0;i--)if(effects[i].dead)effects.splice(i,1);
 refreshSelection();
}
function resize(){const w=root.clientWidth,h=root.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(root);resize();document.getElementById('loading').remove();updateCash();addLog('3D-связь установлена. Снабжение: сомони.');refreshSelection();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000||0,.05);last=now;if(!paused&&!gameOver)update(dt);renderer.render(scene,camera)}requestAnimationFrame(loop);
})();