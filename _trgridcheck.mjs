// verify trainer-select grid fits N trainers on canvas
import { VIEW_W, VIEW_H, ELEMENT_COLORS } from './game/src/config.js';
import { BUILTIN_TRAINERS } from './game/src/run.js';
import { drawSlice, roundRect } from './game/src/hud.js';

const ctx = { fillStyle:'',strokeStyle:'',lineWidth:0,font:'',textAlign:'',globalAlpha:1,
  measureText:()=>({width:80}), fillText:()=>{}, save:()=>{}, restore:()=>{},
  translate:()=>{}, scale:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{},
  closePath:()=>{}, fill:()=>{}, stroke:()=>{}, arc:()=>{}, arcTo:()=>{}, rect:()=>{}, fillRect:()=>{},
  clearRect:()=>{}, drawImage:()=>{}, setTransform:()=>{} };

const fs = await import('node:fs');
const src = fs.readFileSync('game/src/run.js','utf8');
const fnSrc = src.match(/function drawTrainerSelect[\s\S]*?\n}\n/)[0];
globalThis.Image = class { set src(v){} };
const wrap = ()=>{};
const drawCreature = ()=>{};
const panel = ()=>{};
const drawSliceStub = ()=>false; // force fallback drawing (no sprites in node)
const drawTrainerSelect = new Function('BUILTIN_TRAINERS','VIEW_W','VIEW_H','ELEMENT_COLORS','drawSlice','roundRect','drawCreature','wrap','panel',
  fnSrc + '; return drawTrainerSelect;')(BUILTIN_TRAINERS, VIEW_W, VIEW_H, ELEMENT_COLORS, drawSliceStub, roundRect, drawCreature, wrap, panel);

for (const N of [3, 6, 7, 9]) {
  BUILTIN_TRAINERS.length = 0;
  for (let i=0;i<N;i++) BUILTIN_TRAINERS.push({id:'t'+i,name:'Trainer '+i,element:['Verdant','Volt','Ember'][i%3],
    passive:{on:'victory',effect:{type:'shield',amount:6,target:'grass',permanent:true}},
    text:'On Victory: allies gain bonus effect number '+i+'.'});
  const run = {};
  drawTrainerSelect(ctx, run, 0, {x:-1,y:-1});
  let ok = run._btns.length === N;
  for (const b of run._btns)
    if (!(b.x>=0 && b.x+b.w<=VIEW_W && b.y>=0 && b.y+b.h<=VIEW_H)) ok=false;
  console.log(`N=${N}: btns=${run._btns.length} ${ok?'ON CANVAS ok':'FAIL'}`);
}
