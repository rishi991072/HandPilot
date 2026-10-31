import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Activity, Camera, Check, ChevronRight, CircleHelp, Eraser, Hand, Keyboard, MousePointer2, Palette, Pencil, Power, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, Type, Video, VideoOff, Waves } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const MODES = [
  { id: 'translator', title: 'ISL Translator', desc: 'Recognize signs', icon: Hand },
  { id: 'cursor', title: 'Cursor Control', desc: 'Control your PC', icon: MousePointer2 },
  { id: 'drawing', title: 'Air Drawing', desc: 'Draw in the air', icon: Pencil },
  { id: 'keyboard', title: 'Virtual Keyboard', desc: 'Type with gestures', icon: Keyboard },
];
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function fingerUp(lm, tip, pip){ return lm[tip].y < lm[pip].y; }
function gestureOf(lm){
  const index = fingerUp(lm,8,6), middle = fingerUp(lm,12,10), ring = fingerUp(lm,16,14), pinky = fingerUp(lm,20,18);
  const pinch = distance(lm[4],lm[8]) < 0.055;
  if (index && !middle && !ring && !pinky && !pinch) return {name:'Point', index:true, pinch:false};
  if (pinch) return {name:'Pinch', index, pinch:true};
  if (!index && !middle && !ring && !pinky) return {name:'Fist', index:false, pinch:false};
  if (index && middle && ring && pinky) return {name:'Open palm', index:true, pinch:false};
  return {name:'Hand detected', index, pinch:false};
}

export default function App(){
  const videoRef=useRef(null), overlayRef=useRef(null), drawRef=useRef(null), landmarkerRef=useRef(null), streamRef=useRef(null), rafRef=useRef(0), lastPointRef=useRef(null), lastActionRef=useRef(0), handRef=useRef(null), modeRef=useRef('translator'), lastPredictRef=useRef(0), lastSampleRef=useRef(0), sequenceRef=useRef([]), predictionHistoryRef=useRef([]), cursorRef=useRef({x:.5,y:.5}), lastCursorSendRef=useRef(0), lastPinchRef=useRef(false), lastFistRef=useRef(false), predictionInFlightRef=useRef(false), cameraSessionRef=useRef(0), keyboardHoverRef=useRef(''), keyboardHoverSinceRef=useRef(0), lastKeyboardKeyRef=useRef('');
  const [mode,setMode]=useState('translator'), [cameraOn,setCameraOn]=useState(false), [loading,setLoading]=useState(false), [notice,setNotice]=useState('Start your camera to begin'), [apiState,setApiState]=useState('Checking backend…'), [handSeen,setHandSeen]=useState(false), [gesture,setGesture]=useState('No hand detected'), [prediction,setPrediction]=useState('Waiting for sign'), [confidence,setConfidence]=useState(0), [sentence,setSentence]=useState(''), [drawColor,setDrawColor]=useState('#5eead4'), [brush,setBrush]=useState(7), [eraser,setEraser]=useState(false), [typed,setTyped]=useState(''), [keyHover,setKeyHover]=useState(''), [showHelp,setShowHelp]=useState(false);
  const drawSettingsRef=useRef({drawColor,brush,eraser}); drawSettingsRef.current={drawColor,brush,eraser};
  const modeChange=useCallback((id)=>{modeRef.current=id;setMode(id);setNotice(`${MODES.find(m=>m.id===id)?.title} selected`);lastPointRef.current=null;sequenceRef.current=[];predictionHistoryRef.current=[];lastPinchRef.current=false;lastFistRef.current=false;keyboardHoverRef.current='';keyboardHoverSinceRef.current=0;lastKeyboardKeyRef.current='';setKeyHover('');setGesture('No hand detected');},[]);

  useEffect(()=>{ fetch(`${API}/health`).then(r=>r.ok?r.json():Promise.reject()).then(d=>setApiState(d.status==='healthy'?'Backend connected':'Backend ready')).catch(()=>setApiState('Backend offline')); },[]);

  const resizeCanvases=useCallback(()=>{
    const video=videoRef.current, overlay=overlayRef.current, drawing=drawRef.current;
    if(!video) return;
    const w=video.videoWidth||640,h=video.videoHeight||480;
    [overlay,drawing].forEach(c=>{
      if(!c || (c.width===w && c.height===h)) return;
      let saved=null;
      if(c===drawing && c.width>0 && c.height>0){
        saved=document.createElement('canvas'); saved.width=c.width; saved.height=c.height;
        saved.getContext('2d')?.drawImage(c,0,0);
      }
      c.width=w; c.height=h;
      if(c===drawing){
        const ctx=c.getContext('2d');
        if(ctx){ctx.lineCap='round';ctx.lineJoin='round';if(saved)ctx.drawImage(saved,0,0,w,h);}
      }
    });
  },[]);

  const stopCamera=useCallback(()=>{
    cameraSessionRef.current+=1;
    cancelAnimationFrame(rafRef.current);
    if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    try{landmarkerRef.current?.close?.();}catch{}
    landmarkerRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    sequenceRef.current=[];predictionHistoryRef.current=[];predictionInFlightRef.current=false;
    setCameraOn(false);setLoading(false);setHandSeen(false);setGesture('No hand detected');
    handRef.current=null;lastPointRef.current=null;lastPinchRef.current=false;lastFistRef.current=false;
    setPrediction('Waiting for sign');setConfidence(0);setNotice('Camera stopped');
  },[]);

  const startCamera=useCallback(async()=>{
    if(cameraOn||loading)return;
    if(!navigator.mediaDevices?.getUserMedia){setNotice('Camera is unavailable. Open the app on localhost or HTTPS and check browser permissions.');return;}
    const session=++cameraSessionRef.current;
    setLoading(true);setNotice('Requesting camera permission…');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:720},facingMode:'user'},audio:false});
      if(session!==cameraSessionRef.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;const video=videoRef.current;video.srcObject=stream;await video.play();
      if(session!==cameraSessionRef.current)return;
      const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
      if(session!==cameraSessionRef.current)return;
      const landmarker=await HandLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.20,minHandPresenceConfidence:.20,minTrackingConfidence:.25});
      if(session!==cameraSessionRef.current){landmarker.close();return;}
      landmarkerRef.current=landmarker;
      setCameraOn(true);setNotice('Camera ready — keep your hand inside the camera frame');
      const loop=async()=>{
        if(session!==cameraSessionRef.current||!videoRef.current||!landmarkerRef.current||!streamRef.current)return;
        const v=videoRef.current;
        if(v.readyState>=2){resizeCanvases();const result=landmarkerRef.current.detectForVideo(v,performance.now());const ctx=overlayRef.current?.getContext('2d');if(ctx){ctx.clearRect(0,0,overlayRef.current.width,overlayRef.current.height);if(result.landmarks){for(const hand of result.landmarks){ctx.strokeStyle='#5eead4';ctx.fillStyle='#eafffb';ctx.lineWidth=3;const edges=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];edges.forEach(([a,b])=>{ctx.beginPath();ctx.moveTo(hand[a].x*ctx.canvas.width,hand[a].y*ctx.canvas.height);ctx.lineTo(hand[b].x*ctx.canvas.width,hand[b].y*ctx.canvas.height);ctx.stroke();});hand.forEach(p=>{ctx.beginPath();ctx.arc(p.x*ctx.canvas.width,p.y*ctx.canvas.height,4,0,Math.PI*2);ctx.fill();});}}}
          const hands=result.landmarks||[];const lm=hands[0];setHandSeen(!!lm);handRef.current=lm||null;
          if(lm){
            const g=gestureOf(lm);
            setGesture(g.name);
            const point={x:1-lm[8].x,y:lm[8].y};
            const drawPoint={x:lm[8].x,y:lm[8].y};
            const active=modeRef.current;
            const now=performance.now();
            const pinchStarted=g.pinch&&!lastPinchRef.current;
            const fistStarted=g.name==='Fist'&&!lastFistRef.current;
            lastPinchRef.current=g.pinch;
            lastFistRef.current=g.name==='Fist';

            if(active==='drawing'){
              const canvas=drawRef.current, dctx=canvas?.getContext('2d');
              if(dctx){
                if(g.index){
                  if(lastPointRef.current){
                    dctx.globalCompositeOperation=drawSettingsRef.current.eraser?'destination-out':'source-over';
                    dctx.strokeStyle=drawSettingsRef.current.drawColor;
                    dctx.lineWidth=drawSettingsRef.current.eraser?Math.max(18,drawSettingsRef.current.brush*2):drawSettingsRef.current.brush;
                    dctx.beginPath();
                    dctx.moveTo(lastPointRef.current.x*canvas.width,lastPointRef.current.y*canvas.height);
                    dctx.lineTo(drawPoint.x*canvas.width,drawPoint.y*canvas.height);
                    dctx.stroke();
                  }
                  lastPointRef.current=drawPoint;
                } else lastPointRef.current=null;
              }
            }

            if(active==='cursor'&&now-lastCursorSendRef.current>70){
              lastCursorSendRef.current=now;
              if(g.index){
                cursorRef.current={x:cursorRef.current.x*.65+point.x*.35,y:cursorRef.current.y*.65+point.y*.35};
                fetch(`${API}/gesture`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',x:cursorRef.current.x,y:cursorRef.current.y})}).catch(()=>{});
              }
              if(pinchStarted&&now-lastActionRef.current>450){
                lastActionRef.current=now;
                fetch(`${API}/gesture`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'click'})}).catch(()=>{});
              }
              if(fistStarted&&now-lastActionRef.current>450){
                lastActionRef.current=now;
                fetch(`${API}/gesture`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'enter'})}).catch(()=>{});
              }
            }

            if(active==='keyboard'){
              const k=keyAt(point.x,point.y);
              setKeyHover(k||'');
              if(k!==keyboardHoverRef.current){keyboardHoverRef.current=k;keyboardHoverSinceRef.current=now;}
              // Require a deliberate pinch, a stable target, and a cooldown to prevent accidental typing.
              const stableTarget=!!k&&now-keyboardHoverSinceRef.current>=250;
              if(pinchStarted&&stableTarget&&k!==lastKeyboardKeyRef.current&&now-lastActionRef.current>650){
                lastActionRef.current=now;lastKeyboardKeyRef.current=k;
                if(k==='SPACE')setTyped(t=>t+' ');
                else if(k==='BACKSPACE')setTyped(t=>t.slice(0,-1));
                else if(k==='ENTER')setTyped(t=>t+'\n');
                else setTyped(t=>t+k);
              }
              if(!g.pinch)lastKeyboardKeyRef.current='';
            } else setKeyHover('');

            if(active==='translator'){
              if(now-lastSampleRef.current>=70){
                lastSampleRef.current=now;
                sequenceRef.current.push(handsToFeatures(result));
                if(sequenceRef.current.length>30)sequenceRef.current.shift();
              }
              if(sequenceRef.current.length===30&&now-lastPredictRef.current>=350&&!predictionInFlightRef.current){
                lastPredictRef.current=now;predictionInFlightRef.current=true;
                const sequence=sequenceRef.current.map(frame=>frame.slice());
                fetch(`${API}/predict`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sequence})})
                  .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(typeof d.detail==='string'?d.detail:'Prediction service unavailable');return d;})
                  .then(d=>{
                    if(session!==cameraSessionRef.current||modeRef.current!=='translator'||!d.success)return;
                    const label=d.prediction||'Unknown';
                    const score=Number(d.confidence_percent??(d.confidence||0)*100);
                    setConfidence(Math.round(score));
                    if(label==='Unknown'||score<60){
                      predictionHistoryRef.current=[];
                      setPrediction('Hold sign steady…');
                      return;
                    }
                    const history=predictionHistoryRef.current;
                    history.push({label,score});
                    if(history.length>3)history.shift();
                    const counts={};
                    history.forEach(item=>{counts[item.label]=(counts[item.label]||0)+1;});
                    const winner=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
                    if(winner&&winner[1]>=2)setPrediction(winner[0]);
                    else setPrediction('Checking sign…');
                  })
                  .catch(err=>{if(session===cameraSessionRef.current)setNotice(`Translator: ${err.message}`);})
                  .finally(()=>{predictionInFlightRef.current=false;});
              }
            }
          }else{setGesture('No hand detected');lastPointRef.current=null;lastPinchRef.current=false;lastFistRef.current=false;setKeyHover('');keyboardHoverRef.current='';keyboardHoverSinceRef.current=0;lastKeyboardKeyRef.current='';if(modeRef.current==='translator'){sequenceRef.current=[];predictionHistoryRef.current=[];setPrediction('Show a sign');setConfidence(0);}}
        }
        rafRef.current=requestAnimationFrame(loop);
      };rafRef.current=requestAnimationFrame(loop);
    }catch(e){
      console.error(e);
      setNotice(`Could not start camera: ${e.name==='NotAllowedError'?'camera permission was denied':e.name==='NotFoundError'?'no camera was found':(e.message||'permission or model download failed')}`);
      if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());
      streamRef.current=null;
      try{landmarkerRef.current?.close?.();}catch{}
      landmarkerRef.current=null;
      if(videoRef.current)videoRef.current.srcObject=null;
      setCameraOn(false);setHandSeen(false);
    }finally{if(session===cameraSessionRef.current)setLoading(false);}
  },[cameraOn,loading,resizeCanvases]);

  useEffect(()=>()=>{cameraSessionRef.current+=1;cancelAnimationFrame(rafRef.current);if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());try{landmarkerRef.current?.close?.();}catch{}},[]);
  function clearDrawing(){const c=drawRef.current;if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);lastPointRef.current=null;}
  function addSign(){if(prediction&&prediction!=='Waiting for sign'&&prediction!=='Unknown')setSentence(s=>`${s}${s?' ':''}${prediction}`);}
  function keyAt(x,y){
    // Coordinates are mirrored to match the preview. Match each visible row's actual width.
    if(y>=.70&&y<=.90){
      if(x<.34)return 'SPACE';
      if(x<.68)return 'BACKSPACE';
      return 'ENTER';
    }
    if(y<.16||y>.90)return '';
    const row=y<.34?0:y<.52?1:2;
    const keys=KEY_ROWS[row];
    const bounds=row===0?[.05,.95]:row===1?[.10,.90]:[.17,.83];
    if(x<bounds[0]||x>bounds[1])return '';
    const relative=(x-bounds[0])/(bounds[1]-bounds[0]);
    const index=Math.min(keys.length-1,Math.max(0,Math.floor(relative*keys.length)));
    return keys[index]||'';
  }
  function handsToFeatures(result){const arr=new Array(126).fill(0);const hands=result.landmarks||[];const categories=result.handednesses||[];for(let i=0;i<hands.length;i++){const label=categories[i]?.[0]?.categoryName;const offset=label==='Left'?0:63;const pts=hands[i],w=pts[0];let max=0;const centered=pts.map(p=>({x:p.x-w.x,y:p.y-w.y,z:p.z-w.z}));centered.forEach(p=>max=Math.max(max,Math.hypot(p.x,p.y,p.z)));centered.forEach((p,j)=>{const k=offset+j*3;arr[k]=max?p.x/max:0;arr[k+1]=max?p.y/max:0;arr[k+2]=max?p.z/max:0;});}return arr;}

  const activeTitle=MODES.find(m=>m.id===mode)?.title;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Waves size={25}/></div><div><b>HANDPILOT <span>AI</span></b><small>ACCESSIBILITY STUDIO</small></div></div><div className="side-label">WORKSPACE</div><nav>{MODES.map(({id,title,desc,icon:Icon})=><button key={id} onClick={()=>modeChange(id)} className={`nav-item ${mode===id?'selected':''}`}><Icon size={19}/><span><b>{title}</b><small>{desc}</small></span>{mode===id&&<ChevronRight size={16} className="nav-arrow"/>}</button>)}</nav><div className="sidebar-bottom"><div className="status-line"><span className={`status-dot ${cameraOn?'live':''}`}/><span>{cameraOn?'Camera is live':'Camera is off'}</span></div><div className="status-line"><span className={`status-dot ${apiState==='Backend connected'?'live':''}`}/><span>{apiState}</span></div><button className="help-link" onClick={()=>setShowHelp(v=>!v)}><CircleHelp size={16}/> Quick gesture guide</button>{showHelp&&<div className="help-mini">☝ Point: draw or move<br/>🤏 Pinch: click / select<br/>✊ Fist: Enter<br/>🖐 Open palm: pause</div>}</div></aside>
  <main className="main"><header className="topbar"><div><div className="eyebrow">ACCESSIBLE INTERACTION PLATFORM</div><h1>{activeTitle}</h1><p>Natural hand interaction, designed to feel effortless.</p></div><div className="top-actions"><span className={`api-pill ${apiState==='Backend connected'?'good':''}`}><span className="status-dot"/>{apiState}</span><button className={cameraOn?'btn danger':'btn primary'} onClick={cameraOn?stopCamera:startCamera} disabled={loading}>{cameraOn?<VideoOff size={17}/>:<Video size={17}/>} {loading?'Starting…':cameraOn?'Stop camera':'Start camera'}</button></div></header>
  <div className="mode-strip">{MODES.map(({id,title,icon:Icon},i)=><button key={id} className={mode===id?'mode-chip active':'mode-chip'} onClick={()=>modeChange(id)}><Icon size={16}/><span>{title}</span><small>0{i+1}</small></button>)}</div>
  <div className="content-grid"><section className="camera-card"><div className="card-head"><div><span className="kicker">LIVE INPUT</span><h2>Camera workspace</h2></div><span className={`live-badge ${cameraOn?'on':''}`}><span/> {cameraOn?'LIVE':'OFFLINE'}</span></div><div className="camera-stage"><video ref={videoRef} playsInline muted className="camera-video"/><canvas ref={overlayRef} className="landmark-canvas"/><canvas ref={drawRef} className={`drawing-canvas ${mode==='drawing'?'drawing-active':''}`}/> {cameraOn&&mode==='keyboard'&&<div className="gesture-keyboard-overlay" aria-label="Gesture keyboard guide">{KEY_ROWS.map(row=><div className="gesture-key-row" key={row}>{row.split('').map(k=><span key={k} className={keyHover===k?'key-target':''}>{k}</span>)}</div>)}<div className="gesture-key-row gesture-key-special"><span className={keyHover==='SPACE'?'key-target':''}>SPACE</span><span className={keyHover==='BACKSPACE'?'key-target':''}>BACK</span><span className={keyHover==='ENTER'?'key-target':''}>ENTER</span></div></div>}{!cameraOn&&<div className="camera-empty"><div className="camera-icon"><Camera size={31}/></div><b>Your camera workspace</b><p>Start the camera and place your hand inside the frame.</p><button className="btn primary" onClick={startCamera} disabled={loading}><Camera size={16}/> Start camera</button></div>}<div className="camera-hud"><span><span className={`status-dot ${handSeen?'live':''}`}/>{handSeen?'Hand detected':'Waiting for hand'}</span><span>{gesture}</span></div></div><div className="camera-foot"><span><ShieldCheck size={16}/> Processing on your device where possible</span><span><Activity size={16}/> {handSeen?'Tracking active':'Tracking idle'}</span></div></section>
  <section className="tool-card"><div className="card-head"><div><span className="kicker">ACTIVE TOOL</span><h2>{mode==='translator'?'Sign recognition':mode==='cursor'?'Desktop cursor':mode==='drawing'?'Air drawing canvas':'Gesture keyboard'}</h2></div><div className="tool-icon"><Sparkles size={20}/></div></div>
  {mode==='translator'&&<div className="tool-body"><div className="prediction-box"><div className="prediction-label">CURRENT PREDICTION</div><div className="prediction-word">{prediction}</div><div className="confidence-row"><span>Confidence</span><b>{confidence}%</b></div><div className="confidence-track"><i style={{width:`${Math.max(0,Math.min(100,confidence))}%`}}/></div><button className="btn primary wide" onClick={addSign} disabled={!prediction||['Waiting for sign','Unknown','Checking sign…','Hold sign steady…','Show a sign'].includes(prediction)}><Check size={17}/> Add sign to sentence</button></div><div className="sentence-box"><div className="sentence-title"><Type size={16}/> TRANSLATED SENTENCE</div><p>{sentence||'Your recognized signs will appear here.'}</p><div className="sentence-actions"><button className="btn subtle" onClick={()=>setSentence('')}><Trash2 size={15}/> Clear</button><button className="btn subtle" onClick={()=>navigator.clipboard?.writeText(sentence)} disabled={!sentence}><Check size={15}/> Copy text</button></div></div><div className="info-note"><CircleHelp size={17}/><span>Recognition requires the trained model to be installed in the backend. The interface does not guess a sign when the model is unavailable.</span></div></div>}
  {mode==='cursor'&&<div className="tool-body"><div className="gesture-hero"><div className="gesture-emoji">☝️</div><div><b>{handSeen?'Hand is being tracked':'Waiting for hand'}</b><p>Point with your index finger to move the mouse.</p></div></div><div className="gesture-list"><div><span>☝️</span><b>Point</b><small>Move cursor</small></div><div><span>🤏</span><b>Pinch</b><small>Left click</small></div><div><span>✊</span><b>Fist</b><small>Press Enter</small></div></div><div className="warning-note">Cursor control sends actions to your desktop. Keep your hand relaxed and stop the camera to pause control.</div></div>}
  {mode==='drawing'&&<div className="tool-body"><div className="drawing-tip"><Pencil size={18}/><span><b>Point to draw</b><small>Extend your index finger. Lower it to stop drawing.</small></span></div><div className="control-label"><Palette size={16}/> BRUSH COLOR</div><div className="swatches">{['#5eead4','#60a5fa','#c084fc','#fb7185','#fbbf24','#f8fafc','#111827'].map(c=><button key={c} aria-label={`Choose ${c}`} className={`swatch ${drawColor===c?'chosen':''}`} style={{background:c}} onClick={()=>{setDrawColor(c);setEraser(false)}}/> )}</div><div className="control-label">BRUSH SIZE <b>{brush}px</b></div><input className="range" type="range" min="2" max="22" value={brush} onChange={e=>setBrush(Number(e.target.value))}/><div className="drawing-actions"><button className={`btn ${eraser?'primary':'subtle'}`} onClick={()=>setEraser(v=>!v)}><Eraser size={16}/>{eraser?'Eraser on':'Eraser'}</button><button className="btn subtle" onClick={clearDrawing}><Trash2 size={16}/> Clear canvas</button></div><div className="info-note"><Sparkles size={17}/><span>Drawings stay on this page. Choose a color or eraser, then use your index finger to draw over the camera view.</span></div></div>}
  {mode==='keyboard'&&<div className="tool-body"><div className="typed-box"><label>YOUR TEXT</label><textarea value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Gesture-selected keys will appear here…"/><div className="sentence-actions"><button className="btn subtle" onClick={()=>setTyped(t=>t.slice(0,-1))}><Eraser size={15}/> Backspace</button><button className="btn subtle" onClick={()=>setTyped('')}><Trash2 size={15}/> Clear</button><button className="btn subtle" onClick={()=>navigator.clipboard?.writeText(typed)}><Check size={15}/> Copy</button></div></div><div className="keyboard"><div className="keyboard-label">CLICK A KEY OR PINCH WHILE POINTING</div>{KEY_ROWS.map((row,i)=><div className="key-row" key={row}>{row.split('').map(k=><button key={k} onClick={()=>setTyped(t=>t+k)}>{k}</button>)}</div>)}<div className="key-row special"><button onClick={()=>setTyped(t=>t+' ')}>SPACE</button><button onClick={()=>setTyped(t=>t.slice(0,-1))}>BACKSPACE</button><button onClick={()=>setTyped(t=>t+'\n')}>ENTER</button></div></div><div className="info-note"><Keyboard size={17}/><span>This virtual keyboard types inside this app. Typing into other Windows applications requires OS-level keyboard integration and is not enabled by this browser-only keyboard.</span></div></div>}
  </section></div><footer className="footer"><span>ISLBridge AI <span className="footer-dot">•</span> Assistive technology prototype</span><span>{notice}</span></footer></main></div>;
}
