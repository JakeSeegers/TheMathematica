import{$ as e,$n as t,$r as n,Aa as r,An as i,Bn as a,Cn as o,Dr as s,Er as c,Fa as l,Fn as u,Gn as d,Hn as f,Ia as p,In as m,Jn as h,Kn as g,Ln as _,Mn as v,Mr as y,Nn as b,On as x,Or as S,Pa as C,Pr as w,Qa as T,Qr as E,Ra as D,Rn as O,Si as k,Sr as A,Ta as j,Tn as M,Tr as ee,Ur as te,Vn as ne,Wn as N,Wr as re,Zn as ie,Zr as ae,_n as P,_r as oe,ar as F,ba as se,bn as ce,ci as le,di as ue,ei as de,er as fe,fi as pe,ga as me,gr as he,ha as ge,hi as _e,ii as ve,ir as ye,jr as be,kn as xe,kr as Se,li as Ce,ni as we,nr as Te,or as Ee,ot as De,pa as Oe,pi as ke,ta as Ae,vn as I,vr as je,wn as Me,wr as Ne,xa as Pe,xi as Fe,xn as L,yn as Ie,zn as Le}from"./LevelStorage-BIxTLbPi.js";import{A as R,C as Re,D as ze,E as Be,N as Ve,O as He,P as Ue,T as We,_ as Ge,b as Ke,k as qe,l as Je,t as Ye,v as Xe,w as Ze,y as Qe}from"./config-D-hez74n.js";var $e=Object.freeze({up:[`KeyW`,`ArrowUp`],down:[`KeyS`,`ArrowDown`],left:[`KeyA`,`ArrowLeft`],right:[`KeyD`,`ArrowRight`],run:[`ShiftLeft`,`ShiftRight`],confirm:[`Space`,`Enter`,`KeyF`],cancel:[`Escape`,`Backspace`],camLeft:[`KeyQ`],camRight:[`KeyE`],zoomIn:[`KeyZ`,`Equal`],zoomOut:[`KeyX`,`Minus`],debug:[`Backquote`,`F1`],time:[`KeyT`],photo:[`KeyP`],help:[`KeyH`],weather:[`KeyR`],music:[`KeyM`],map:[`KeyN`,`Tab`]}),et=Object.freeze({confirm:[`GamepadA`],cancel:[`GamepadB`],camLeft:[`GamepadLB`],camRight:[`GamepadRB`],run:[`GamepadRT`],up:[`GamepadDpadUp`],down:[`GamepadDpadDown`],left:[`GamepadDpadLeft`],right:[`GamepadDpadRight`],zoomIn:[`GamepadY`],zoomOut:[`GamepadX`],help:[`GamepadStart`],map:[`GamepadBack`],photo:[`GamepadRS`]}),tt=Object.freeze([`GamepadA`,`GamepadB`,`GamepadX`,`GamepadY`,`GamepadLB`,`GamepadRB`,`GamepadLT`,`GamepadRT`,`GamepadBack`,`GamepadStart`,`GamepadLS`,`GamepadRS`,`GamepadDpadUp`,`GamepadDpadDown`,`GamepadDpadLeft`,`GamepadDpadRight`,`GamepadHome`]),nt=e=>Object.fromEntries(Object.entries(e).map(([e,t])=>[e,[...t]]));function rt(e){if(!e||e.nodeType!==1)return!1;if(e.isContentEditable)return!0;let t=e.tagName;if(t===`TEXTAREA`||t===`SELECT`)return!0;if(t===`INPUT`){let t=(e.type||`text`).toLowerCase();return![`button`,`checkbox`,`radio`,`submit`,`reset`,`image`,`color`,`file`,`range`].includes(t)}return!1}var it=class{constructor(e=window,t={}){this.target=e,this.enabled=!0,this.bindings=nt($e),this.padBindings=nt(et),this.deadzone=t.deadzone??.2,this.triggerThreshold=.35,this.wheelIgnoreSelector=t.wheelIgnoreSelector??`.lil-gui, input, textarea, select, [contenteditable], [data-input-ignore]`,this.wheelDelta=0,this.pointer={x:0,y:0,down:!1,buttons:0,inside:!1},this.gamepad={connected:!1,index:-1,id:``,leftStick:{x:0,y:0},rightStick:{x:0,y:0},leftTrigger:0,rightTrigger:0},this._down=new Set,this._pressed=new Set,this._released=new Set,this._padDown=new Set,this._padKnown=0,this._move={x:0,y:0},this._look={x:0,y:0},this._boundCodes=new Set,this._boundCacheKey=``,this.lastDevice=`keyboard`,this._mouseTarget=null,this._mouseDown=new Set,this._onKeyDown=this._onKeyDown.bind(this),this._onKeyUp=this._onKeyUp.bind(this),this._onBlur=this._onBlur.bind(this),this._onVisibility=this._onVisibility.bind(this),this._onWheel=this._onWheel.bind(this),this._onPointerMove=this._onPointerMove.bind(this),this._onPointerDown=this._onPointerDown.bind(this),this._onPointerUp=this._onPointerUp.bind(this),this._onPointerLeave=this._onPointerLeave.bind(this),this._onPadConnected=this._onPadConnected.bind(this),this._onPadDisconnected=this._onPadDisconnected.bind(this);let n=e;n.addEventListener(`keydown`,this._onKeyDown),n.addEventListener(`keyup`,this._onKeyUp),n.addEventListener(`wheel`,this._onWheel,{passive:!0}),n.addEventListener(`pointermove`,this._onPointerMove,{passive:!0}),n.addEventListener(`pointerdown`,this._onPointerDown,{passive:!0}),n.addEventListener(`pointerup`,this._onPointerUp,{passive:!0}),n.addEventListener(`pointercancel`,this._onPointerUp,{passive:!0}),typeof window<`u`&&(window.addEventListener(`blur`,this._onBlur),window.addEventListener(`gamepadconnected`,this._onPadConnected),window.addEventListener(`gamepaddisconnected`,this._onPadDisconnected),document.addEventListener(`visibilitychange`,this._onVisibility),document.documentElement.addEventListener(`pointerleave`,this._onPointerLeave))}isDown(e){return this.enabled&&(this._down.has(e)||this._padDown.has(e))}wasPressed(e){return this.enabled&&this._pressed.has(e)}wasReleased(e){return this.enabled&&this._released.has(e)}anyPressed(){return this.enabled&&this._pressed.size>0}action(e){return this.enabled?this._anyOf(this.bindings[e],this._down,this._padDown)||this._anyOf(this.padBindings[e],this._padDown,null):!1}actionPressed(e){return this.enabled?this._anyOf(this.bindings[e],this._pressed,null)||this._anyOf(this.padBindings[e],this._pressed,null):!1}actionReleased(e){return this.enabled?this._anyOf(this.bindings[e],this._released,null)||this._anyOf(this.padBindings[e],this._released,null):!1}consumeAction(e){let t=this.actionPressed(e);if(t){let t=this.bindings[e],n=this.padBindings[e];if(t)for(let e=0;e<t.length;e++)this._pressed.delete(t[e]);if(n)for(let e=0;e<n.length;e++)this._pressed.delete(n[e])}return t}_anyOf(e,t,n){if(!e)return!1;for(let r=0;r<e.length;r++){let i=e[r];if(t.has(i)||n!==null&&n.has(i))return!0}return!1}getMoveVector(e=this._move){if(e.x=0,e.y=0,!this.enabled)return e;let t=+!!this.action(`right`)-!!this.action(`left`),n=+!!this.action(`up`)-!!this.action(`down`);t!==0&&n!==0&&(t*=Math.SQRT1_2,n*=Math.SQRT1_2);let r=t+this.gamepad.leftStick.x,i=n+this.gamepad.leftStick.y,a=Math.hypot(r,i);return a>1&&(r/=a,i/=a),e.x=r,e.y=i,e}getLookVector(e=this._look){return e.x=this.enabled?this.gamepad.rightStick.x:0,e.y=this.enabled?this.gamepad.rightStick.y:0,e}addBindings(e={},t={}){for(let[t,n]of Object.entries(e??{}))this.bindings[t]=[...n??[]];for(let[e,n]of Object.entries(t??{}))this.padBindings[e]=[...n??[]];this._boundCacheKey=``}enableMouseButtons(e){e&&typeof window<`u`&&(this._mouseTarget&&this._disableMouseButtons(),this._mouseTarget=e,this._onMouseDown??=this._mouseDownEdge.bind(this),this._onMouseMove??=this._mouseChord.bind(this),this._onMouseUp??=this._mouseUpEdge.bind(this),this._onContextMenu??=e=>e.preventDefault(),this._onAuxDown??=e=>{e.button===1&&e.preventDefault()},window.addEventListener(`pointerdown`,this._onMouseDown,{capture:!0,passive:!0}),window.addEventListener(`pointermove`,this._onMouseMove,{capture:!0,passive:!0}),window.addEventListener(`pointerup`,this._onMouseUp,{capture:!0,passive:!0}),window.addEventListener(`pointercancel`,this._onMouseUp,{capture:!0,passive:!0}),e.addEventListener(`contextmenu`,this._onContextMenu),e.addEventListener(`mousedown`,this._onAuxDown))}saveBindings(){return{keyboard:nt(this.bindings),pad:nt(this.padBindings)}}restoreBindings(e){this.bindings=nt(e.keyboard),this.padBindings=nt(e.pad),this._boundCacheKey=``}disableMouseButtons(){this._disableMouseButtons()}_disableMouseButtons(){let e=this._mouseTarget;if(e){window.removeEventListener(`pointerdown`,this._onMouseDown,{capture:!0}),window.removeEventListener(`pointermove`,this._onMouseMove,{capture:!0}),window.removeEventListener(`pointerup`,this._onMouseUp,{capture:!0}),window.removeEventListener(`pointercancel`,this._onMouseUp,{capture:!0}),e.removeEventListener(`contextmenu`,this._onContextMenu),e.removeEventListener(`mousedown`,this._onAuxDown);for(let e of this._mouseDown)this._releaseCode(e);this._mouseDown.clear(),this._mouseTarget=null}}_mouseDownEdge(e){e.target===this._mouseTarget&&this._pressMouse(e.button)}_mouseChord(e){let t=e.button;if(!(t>=0&&t<=2))return;let n=t===1?4:t===2?2:1;e.buttons&n?e.target===this._mouseTarget&&this._pressMouse(t):this._releaseCode(`Mouse${t}`)}_mouseUpEdge(e){let t=e.button;if(t>=0&&t<=2&&this._releaseCode(`Mouse${t}`),this._mouseDown.size&&typeof e.buttons==`number`)for(let t of this._mouseDown){let n=+t.charAt(5),r=n===1?4:n===2?2:1;e.buttons&r||this._releaseCode(t)}}_pressMouse(e){if(!(e>=0&&e<=2))return;let t=`Mouse${e}`;this._down.has(t)||(this._down.add(t),this._mouseDown.add(t),this._pressed.add(t),this.lastDevice=`mouse`)}_releaseCode(e){this._mouseDown.delete(e),this._down.delete(e)&&this._released.add(e)}update(){if(this._padKnown<=0&&!this.gamepad.connected)return;let e=typeof navigator<`u`?navigator:null;if(!e||typeof e.getGamepads!=`function`)return;let t;try{t=e.getGamepads()}catch{return}let n=null;for(let e=0;e<t.length;e++){let r=t[e];if(r&&r.connected){n=r;break}}let r=this.gamepad;if(!n){r.connected&&this._releasePad(),r.connected=!1,r.index=-1;return}r.connected=!0,r.index=n.index,r.id=n.id;let i=n.mapping===`standard`,a=n.axes;this._stick(r.leftStick,a[0]??0,a[1]??0),this._stick(r.rightStick,a[2]??0,a[3]??0);let o=n.buttons,s=Math.min(o.length,tt.length);for(let e=0;e<s;e++){let t=o[e],n;if(e===6||e===7){let i=t.value??+!!t.pressed;e===6?r.leftTrigger=i:r.rightTrigger=i,n=i>this.triggerThreshold||t.pressed&&i===0}else n=t.pressed;!i&&e>11&&(n=!1),this._setPad(tt[e],n)}}endFrame(){this._pressed.size&&this._pressed.clear(),this._released.size&&this._released.clear(),this.wheelDelta=0}reset(){for(let e of this._down)this._released.add(e);this._down.clear(),this._mouseDown.clear(),this._releasePad(),this.pointer.down=!1,this.pointer.buttons=0,this.wheelDelta=0}dispose(){let e=this.target;e.removeEventListener(`keydown`,this._onKeyDown),e.removeEventListener(`keyup`,this._onKeyUp),e.removeEventListener(`wheel`,this._onWheel),e.removeEventListener(`pointermove`,this._onPointerMove),e.removeEventListener(`pointerdown`,this._onPointerDown),e.removeEventListener(`pointerup`,this._onPointerUp),e.removeEventListener(`pointercancel`,this._onPointerUp),typeof window<`u`&&(window.removeEventListener(`blur`,this._onBlur),window.removeEventListener(`gamepadconnected`,this._onPadConnected),window.removeEventListener(`gamepaddisconnected`,this._onPadDisconnected),document.removeEventListener(`visibilitychange`,this._onVisibility),document.documentElement.removeEventListener(`pointerleave`,this._onPointerLeave),this._disableMouseButtons()),this._down.clear(),this._mouseDown.clear(),this._pressed.clear(),this._released.clear(),this._padDown.clear()}_isBound(e){let t=``;for(let e in this.bindings)t+=e+`:`+this.bindings[e].join(`,`)+`;`;if(t!==this._boundCacheKey){this._boundCacheKey=t,this._boundCodes.clear();for(let e in this.bindings)for(let t of this.bindings[e])this._boundCodes.add(t)}return this._boundCodes.has(e)}_onKeyDown(e){let t=e.code;t&&(rt(e.target)||rt(typeof document<`u`?document.activeElement:null)||(!e.ctrlKey&&!e.metaKey&&!e.altKey&&this._isBound(t)&&e.preventDefault(),this._down.has(t)||(this._down.add(t),e.repeat||(this._pressed.add(t),this.lastDevice=`keyboard`))))}_onKeyUp(e){let t=e.code;t&&(this._down.has(t)&&(this._down.delete(t),this._released.add(t)),!rt(e.target)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&this._isBound(t)&&e.preventDefault())}_onBlur(){this.reset()}_onVisibility(){document.visibilityState===`hidden`&&this.reset()}_onWheel(e){if(!this.enabled)return;let t=e.target;if(t&&t.closest&&this.wheelIgnoreSelector&&t.closest(this.wheelIgnoreSelector))return;let n=e.deltaY;e.deltaMode===1?n*=16:e.deltaMode===2&&(n*=400),this.wheelDelta+=n}_onPointerMove(e){this.pointer.x=e.clientX,this.pointer.y=e.clientY,this.pointer.inside=!0}_onPointerDown(e){this.pointer.x=e.clientX,this.pointer.y=e.clientY,this.pointer.down=!0,this.pointer.buttons=e.buttons,this.pointer.inside=!0}_onPointerUp(e){this.pointer.x=e.clientX,this.pointer.y=e.clientY,this.pointer.buttons=e.buttons??0,this.pointer.down=this.pointer.buttons!==0}_onPointerLeave(){this.pointer.inside=!1}_onPadConnected(){this._padKnown++}_onPadDisconnected(){this._padKnown=Math.max(0,this._padKnown-1)}_stick(e,t,n){let r=Math.hypot(t,n),i=this.deadzone;if(r<=i){e.x=0,e.y=0;return}let a=Math.min(1,(r-i)/(1-i))/r;e.x=t*a,e.y=-n*a}_setPad(e,t){t!==this._padDown.has(e)&&(t?(this._padDown.add(e),this._pressed.add(e),this.lastDevice=`gamepad`):(this._padDown.delete(e),this._released.add(e)))}_releasePad(){for(let e of this._padDown)this._released.add(e);this._padDown.clear();let e=this.gamepad;e.leftStick.x=e.leftStick.y=e.rightStick.x=e.rightStick.y=0,e.leftTrigger=e.rightTrigger=0}},at=1/20,ot=class{constructor(e={}){this.opts=e,this.container=e.container??document.body,this.maxPixelRatio=e.maxPixelRatio??1.5,this._renderScale=_(e.renderScale??1,.25,1);let t=new Ue({antialias:!1,powerPreference:`high-performance`,stencil:!1,preserveDrawingBuffer:!!e.preserveDrawingBuffer});t.shadowMap.enabled=!0;let n=e.shadowMapType??1;n===2&&(n=1),t.shadowMap.type=n,t.toneMapping=4,t.toneMappingExposure=1,t.outputColorSpace=Oe,t.setClearColor(e.clearColor??724506,1),this.renderer=t;let r=t.domElement;r.classList.add(`luminati-canvas`),r.style.display=`block`,r.style.width=`100%`,r.style.height=`100%`,r.style.touchAction=`none`,r.style.outline=`none`,this._isFullWindow()&&(r.style.position=`fixed`,r.style.left=`0`,r.style.top=`0`),r.tabIndex=-1,this.container.appendChild(r),this.scene=new ge,this.camera=new Ce(28,1,.5,400),this.camera.position.set(0,12.7,20.4),this.camera.lookAt(0,0,0),this.input=new it(e.inputTarget??window),this.events=new v,this.time={elapsed:0,delta:0,frame:0,timeScale:1,realDelta:0,realElapsed:0,fps:60},this._systems=[],this._seq=0,this._renderFn=null,this._failed=new WeakMap,this._running=!1,this._manual=!!(e.manualStep??(st(`fixedstep`)&&(st(`autostart`)||st(`debug`)))),this._startedOnce=!1,this._lastNow=-1,this._disposed=!1,this._width=1,this._height=1,this._pixelRatio=1,this.resizeThrottleMs=0,this._lastResizeAt=-1/0,this._resizeTimer=0,this._tick=this._tick.bind(this),this._onWindowResize=()=>this._resize(),this._onContextLost=e=>{e.preventDefault(),console.warn(`[Engine] WebGL context lost`),this.events.emit(`contextlost`)},this._onContextRestored=()=>{console.warn(`[Engine] WebGL context restored`),this.events.emit(`contextrestored`)},r.addEventListener(`webglcontextlost`,this._onContextLost),r.addEventListener(`webglcontextrestored`,this._onContextRestored),this._resizeObserver=null,typeof ResizeObserver<`u`&&!this._isFullWindow()&&(this._resizeObserver=new ResizeObserver(()=>this._resize()),this._resizeObserver.observe(this.container)),window.addEventListener(`resize`,this._onWindowResize),this._resize(!0);let i=e.exposeGlobal;if(i===void 0)try{let e=new URLSearchParams(window.location.search);i=e.has(`debug`)||e.has(`autostart`)}catch{i=!1}i&&(window.__engine=this)}get width(){return this._width}get height(){return this._height}get pixelRatio(){return this._pixelRatio}get aspect(){return this._width/Math.max(1,this._height)}get drawingBufferSize(){return this._dbs??=new C,this.renderer.getDrawingBufferSize(this._dbs)}get canvas(){return this.renderer.domElement}get renderScale(){return this._renderScale}set renderScale(e){let t=_(Number(e)||1,.25,1);t!==this._renderScale&&(this._renderScale=t,this._resize(!0))}_isFullWindow(){return this.container===document.body||this.container===document.documentElement}_measure(){let e,t;if(this._isFullWindow())e=window.innerWidth,t=window.innerHeight;else if(e=this.container.clientWidth,t=this.container.clientHeight,!e||!t){let n=this.container.getBoundingClientRect();e=n.width||window.innerWidth,t=n.height||window.innerHeight}return[Math.max(1,Math.floor(e)),Math.max(1,Math.floor(t))]}_resize(e=!1){if(this._disposed)return;if(!e&&this.resizeThrottleMs>0){let e=(this._lastResizeAt??-1/0)+this.resizeThrottleMs-performance.now();if(e>0){this._resizeTimer||=setTimeout(()=>{this._resizeTimer=0,this._resize()},e);return}}let[t,n]=this._measure(),r=typeof window<`u`&&window.devicePixelRatio||1,i=Math.min(r,this.maxPixelRatio)*this._renderScale;(e||t!==this._width||n!==this._height||i!==this._pixelRatio)&&(this._lastResizeAt=performance.now(),this._width=t,this._height=n,this._pixelRatio=i,this.renderer.getPixelRatio()!==i&&this.renderer.setPixelRatio(i),this.renderer.setSize(t,n,!1),this.camera.aspect=t/n,this.camera.updateProjectionMatrix(),this.events.emit(`resize`,{width:t,height:n,pixelRatio:i}))}resize(){this._resize(!0)}addSystem(e,t=0){if(!e||typeof e!=`object`&&typeof e!=`function`)throw TypeError(`Engine.addSystem: system must be an object`);let n=this._systems.find(t=>t.system===e),r=n?{...n,order:t}:{system:e,order:t,seq:this._seq++,name:e.name||e.constructor?.name||`system`},i=this._systems.filter(t=>t.system!==e);return i.push(r),i.sort((e,t)=>e.order-t.order||e.seq-t.seq),this._systems=i,e}removeSystem(e){let t=this._systems.filter(t=>t.system!==e),n=t.length!==this._systems.length;return this._systems=t,n}get systems(){return this._systems.map(e=>e.system)}setRenderFn(e){this._renderFn=typeof e==`function`?e:null}start(){return this._running||this._disposed?this:(this._running=!0,this._lastNow=-1,this._startedOnce||(this._startedOnce=!0,this._resize(!0)),this._manual||this.renderer.setAnimationLoop(this._tick),this.events.emit(`start`),this)}stop(){return this._running?(this._running=!1,this.renderer.setAnimationLoop(null),this.events.emit(`stop`),this):this}get running(){return this._running}get manualStep(){return this._manual}set manualStep(e){let t=!!e;t===this._manual||this._disposed||(this._manual=t,this._running&&(this._lastNow=-1,this.renderer.setAnimationLoop(t?null:this._tick)))}step(e=1/60,{render:t=!0}={}){this._disposed||this._frame(e,t)}redraw(){this._disposed||this._draw(0,this.time.elapsed)}_tick(e){this._lastNow<0&&(this._lastNow=e);let t=(e-this._lastNow)/1e3;this._lastNow=e,this._frame(t)}_frame(e,t=!0){let n=this.time,r=e>0&&Number.isFinite(e)?e:0,i=(r>at?at:r)*n.timeScale;n.realDelta=r,n.realElapsed+=r,n.delta=i,n.elapsed+=i,n.frame++,r>0&&(n.fps+=(1/r-n.fps)*.05);let a=n.elapsed;this.input.update();let o=this._systems;for(let e=0;e<o.length;e++){let t=o[e].system;if(typeof t.update==`function`)try{t.update(i,a,this)}catch(t){this._report(o[e].system,`update`,`system "${o[e].name}"`,t)}}this._emitSafe(`update`,i,a);for(let e=0;e<o.length;e++){let t=o[e].system;if(typeof t.lateUpdate==`function`)try{t.lateUpdate(i,a,this)}catch(t){this._report(o[e].system,`lateUpdate`,`system "${o[e].name}"`,t)}}this._emitSafe(`lateUpdate`,i,a),!this._disposed&&(R.uTime.value=a,t&&this._draw(i,a),this.input.endFrame())}_draw(e,t){this._emitSafe(`beforeRender`,e,t);try{this._renderFn?this._renderFn(e,t):this.renderer.render(this.scene,this.camera)}catch(e){this._report(this._renderFn??this.renderer,`render`,`render function`,e)}this._emitSafe(`afterRender`,e,t)}_emitSafe(e,t,n){let r=this.events.listeners(e);for(let i=0;i<r.length;i++){let a=r[i];try{a.call(this.events,t,n)}catch(t){this._report(a,e,`'${e}' listener ${a.name?`"${a.name}"`:`(anonymous)`}`,t)}}}_report(e,t,n,r){let i=this._failed.get(e);if(i||(i=new Set,this._failed.set(e,i)),!i.has(t)){i.add(t),console.error(`[Engine] ${n} threw in ${t} (further errors from it are suppressed):`,r);try{this.events.emit(`error`,{label:n,phase:t,error:r})}catch{}}}dispose({disposeScene:e=!0}={}){if(this._disposed)return;this.stop();try{this.events.emit(`dispose`)}catch(e){console.error(`[Engine] 'dispose' listener threw:`,e)}this._disposed=!0;let t=this._systems;for(let e=t.length-1;e>=0;e--){let n=t[e].system;if(typeof n.dispose==`function`)try{n.dispose()}catch(n){console.error(`[Engine] system "${t[e].name}" threw in dispose:`,n)}}this._systems=[],this.input.dispose(),this._resizeObserver?.disconnect(),this._resizeObserver=null,clearTimeout(this._resizeTimer),window.removeEventListener(`resize`,this._onWindowResize),e&&ct(this.scene),this.scene.clear();let n=this.renderer.domElement;n.removeEventListener(`webglcontextlost`,this._onContextLost),n.removeEventListener(`webglcontextrestored`,this._onContextRestored),this.renderer.renderLists.dispose(),this.renderer.dispose();try{this.renderer.forceContextLoss()}catch{}n.remove(),this.events.clear(),typeof window<`u`&&window.__engine===this&&delete window.__engine}};function st(e){try{let t=new URLSearchParams(window.location.search);return t.has(e)&&t.get(e)!==`0`}catch{return!1}}function ct(e){let t=new Set,n=e=>{e&&!t.has(e)&&typeof e.dispose==`function`&&(t.add(e),e.dispose())},r=e=>{if(e&&!t.has(e)){for(let t of Object.keys(e)){let r=e[t];r&&r.isTexture&&n(r)}if(e.uniforms)for(let t of Object.values(e.uniforms)){let e=t?.value;e&&e.isTexture&&n(e)}n(e)}};e.traverse(e=>{e.geometry&&n(e.geometry);let t=e.material;Array.isArray(t)?t.forEach(r):r(t),e.customDepthMaterial&&r(e.customDepthMaterial),e.customDistanceMaterial&&r(e.customDistanceMaterial),e.isLight&&e.shadow?.map&&e.shadow.dispose(),e.isInstancedMesh&&e.dispose?.()});let i=e.background;i&&i.isTexture&&n(i);let a=e.environment;a&&a.isTexture&&n(a)}var lt=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},ut=new le(-1,1,1,-1,0,1),dt=new class extends fe{constructor(){super(),this.setAttribute(`position`,new A([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new A([0,2,0,0,2,0],2))}},ft=class{constructor(e){this._mesh=new E(dt,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ut)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},pt={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},mt={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new F(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},ht=class e extends lt{constructor(e,t=1,r,i){super(),this.strength=t,this.radius=r,this.threshold=i,this.resolution=e===void 0?new C(256,256):new C(e.x,e.y),this.clearColor=new F(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new D(a,o,{type:S,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new D(a,o,{type:S,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new D(a,o,{type:S,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),a=Math.round(a/2),o=Math.round(o/2)}let s=mt;this.highPassUniforms=j.clone(s.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new me({uniforms:this.highPassUniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader}),this.separableBlurMaterials=[];let c=[6,10,14,18,22];a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(c[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/a,1/o),a=Math.round(a/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let u=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=u,this.bloomTintColors=[new l(1,1,1),new l(1,1,1),new l(1,1,1),new l(1,1,1),new l(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=j.clone(pt.uniforms),this.blendMaterial=new me({uniforms:this.copyUniforms,vertexShader:pt.vertexShader,fragmentShader:pt.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new F,this._oldClearAlpha=1,this._basic=new n,this._fsQuad=new ft(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new C(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new me({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new C(.5,.5)},direction:{value:new C(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new me({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};ht.BlurDirectionX=new C(1,0),ht.BlurDirectionY=new C(0,1);var gt={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},_t=class extends lt{constructor(){super(),this.isOutputPass=!0,this.uniforms=j.clone(gt.uniforms),this.material=new Ae({name:gt.name,uniforms:this.uniforms,vertexShader:gt.vertexShader,fragmentShader:gt.fragmentShader}),this._fsQuad=new ft(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},Ee.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},vt=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,yt=`
float pfxLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Scrub NaN / Inf / negative values coming from the scene (one bad pixel would otherwise poison
// every blur kernel that touches it). Tests the exponent bits instead of isnan(), which D3D's
// fast-math compiler is allowed to optimise away.
bool pfxNonFinite(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
vec3 pfxSafe(vec3 c) {
  bool bad = pfxNonFinite(c.r) || pfxNonFinite(c.g) || pfxNonFinite(c.b);
  return bad ? vec3(0.0) : clamp(c, vec3(0.0), vec3(6.0e4));
}

// 8×8 Bayer ordered-dither threshold in [0, 1) (recursive closed form).
float pfxBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float pfxBayer4(vec2 a) { return pfxBayer2(0.5 * a) * 0.25 + pfxBayer2(a); }
float pfxBayer8(vec2 a) { return pfxBayer4(0.5 * a) * 0.25 + pfxBayer2(a); }

// Interleaved gradient noise (Jimenez 2014): cheap, well distributed, in [0, 1).
float pfxIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// Integer-ish hash -> [0, 1) (Dave Hoskins, "hash without sine").
float pfxHash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`,bt={name:`LuminatiCopyShader`,uniforms:{tDiffuse:{value:null}},vertexShader:vt,fragmentShader:`
    ${yt}
    uniform sampler2D tDiffuse;
    void main() {
      gl_FragColor = vec4(pfxSafe(texelFetch(tDiffuse, ivec2(gl_FragCoord.xy), 0).rgb), 1.0);
    }
  `};function xt(){return{tDepth:{value:null},uCamNear:{value:.5},uCamFar:{value:400},uFocusDistance:{value:24},uFocusRange:{value:5},uNearScale:{value:1.4},uFarScale:{value:1},uMaxBlurPx:{value:10},uTilt:{value:new l(.35,.52,.28)},uTiltFeather:{value:.3},uOrtho:{value:0}}}var St=`
#include <packing>
uniform sampler2D tDepth;
uniform float uCamNear;
uniform float uCamFar;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uNearScale;
uniform float uFarScale;
uniform float uMaxBlurPx;
uniform vec3 uTilt; // x = strength, y = centre (uv.y), z = band width (uv)
uniform float uTiltFeather; // uv distance over which the tilt term ramps in
uniform float uOrtho;       // 1 for orthographic cameras

float dofViewDepth(float rawDepth) {
  return uOrtho > 0.5 ? -orthographicDepthToViewZ(rawDepth, uCamNear, uCamFar)
                      : -perspectiveDepthToViewZ(rawDepth, uCamNear, uCamFar);
}

float dofCoC(float rawDepth, float uvY) {
  float z = dofViewDepth(rawDepth);
  float dz = z - uFocusDistance;
  float band = 0.5 * uFocusRange;
  float t = clamp((abs(dz) - band) / max(1.5 * uFocusRange, 1e-3), 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  float coc = dz < 0.0 ? -uNearScale * t : uFarScale * t;
  // screen-space tilt-shift term
  float ty = abs(uvY - uTilt.y) - 0.5 * uTilt.z;
  float tilt = uTilt.x * smoothstep(0.0, max(uTiltFeather, 1e-3), ty);
  if (tilt > abs(coc)) {
    float s = abs(dz) > band ? sign(dz) : (uvY < uTilt.y ? -1.0 : 1.0);
    coc = s * tilt;
  }
  return coc * uMaxBlurPx;
}
`,Ct={name:`LuminatiDofPrefilter`,glslVersion:c,uniforms:{tColor:{value:null},uFullSize:{value:new C(1,1)},uRatio:{value:new C(2,2)},uScale:{value:.5},uBokehThreshold:{value:1.5},uSprites:{value:1}},vertexShader:vt,fragmentShader:`
    ${St}
    ${yt}
    uniform sampler2D tColor;
    uniform vec2 uFullSize;
    uniform vec2 uRatio;
    uniform float uScale;
    uniform float uBokehThreshold;
    uniform float uSprites;
    varying vec2 vUv;
    layout(location = 0) out vec4 outColorCoc;
    layout(location = 1) out vec4 outHighlight;

    void main() {
      vec2 fc = gl_FragCoord.xy * uRatio;           // centre of this texel in full-res pixels
      ivec2 p = ivec2(floor(fc - 0.5));
      ivec2 mx = ivec2(uFullSize) - 1;
      ivec2 p0 = clamp(p, ivec2(0), mx);
      ivec2 p1 = clamp(p + ivec2(1, 0), ivec2(0), mx);
      ivec2 p2 = clamp(p + ivec2(0, 1), ivec2(0), mx);
      ivec2 p3 = clamp(p + ivec2(1, 1), ivec2(0), mx);

      vec3 c0 = texelFetch(tColor, p0, 0).rgb;
      vec3 c1 = texelFetch(tColor, p1, 0).rgb;
      vec3 c2 = texelFetch(tColor, p2, 0).rgb;
      vec3 c3 = texelFetch(tColor, p3, 0).rgb;

      float k0 = dofCoC(texelFetch(tDepth, p0, 0).x, vUv.y);
      float k1 = dofCoC(texelFetch(tDepth, p1, 0).x, vUv.y);
      float k2 = dofCoC(texelFetch(tDepth, p2, 0).x, vUv.y);
      float k3 = dofCoC(texelFetch(tDepth, p3, 0).x, vUv.y);

      float kn = min(min(k0, k1), min(k2, k3));
      float kf = max(max(k0, k1), max(k2, k3));
      float kc = (kn < -1.0 || -kn > kf) ? kn : kf;

      // guard against NaN/Inf from the scene (would poison the whole bokeh kernel)
      c0 = pfxSafe(c0);
      c1 = pfxSafe(c1);
      c2 = pfxSafe(c2);
      c3 = pfxSafe(c3);

      float w0 = 1.0 / (1.0 + (k0 - kc) * (k0 - kc));
      float w1 = 1.0 / (1.0 + (k1 - kc) * (k1 - kc));
      float w2 = 1.0 / (1.0 + (k2 - kc) * (k2 - kc));
      float w3 = 1.0 / (1.0 + (k3 - kc) * (k3 - kc));
      float wsum = w0 + w1 + w2 + w3;
      vec3 col = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / wsum;

      vec4 hl = vec4(0.0);
      // Only highlights the composite actually shows through the blurred layers are scattered:
      // same ramp as its centreA (full-res px). Nearly-focused specks stay in the sharp image;
      // extracting them would double-count them (near pass is added on top of the sharp pixels)
      // or lose them (far discs are clipped to the tiny CoC of their focused surroundings),
      // which made them pulse between 'boosted disc', 'sharp' and 'hollow ring' while panning.
      float spriteGate = smoothstep(2.0, 4.0, abs(kc));
      if (uSprites > 0.5 && spriteGate > 0.0) {
        // highlight energy, decided per full-res pixel (smooth ramp above the threshold)
        float T = uBokehThreshold;
        float l0 = pfxLuma(c0), l1 = pfxLuma(c1), l2 = pfxLuma(c2), l3 = pfxLuma(c3);
        float r0 = smoothstep(T, 2.0 * T, l0), r1 = smoothstep(T, 2.0 * T, l1);
        float r2 = smoothstep(T, 2.0 * T, l2), r3 = smoothstep(T, 2.0 * T, l3);
        if (r0 + r1 + r2 + r3 > 0.0) {
          // isolation: tent-weighted neighbourhood mean (≈14×14 px via 5×5 bilinear 2×2 taps)
          // vs each pixel's OWN luminance. Lone specks → 1 (scattered as boosted discs);
          // extended bright areas → 0 (stay in the normalised gather, which keeps their blurred
          // edges free of dark halos). The 25 taps are re-weighted per pixel so each of the 4
          // pixels gets a tent window centred on itself (pixels sit ±0.25 tap from the block
          // centre, no extra fetches): the result barely depends on how a highlight straddles
          // the reduced-res grid, so boosted bokeh does not pulse while the camera pans (the
          // sprite gain amplifies any jitter here).
          float m0 = 0.0, m1 = 0.0, m2 = 0.0, m3 = 0.0;
          for (int y = -2; y <= 2; y++) {
            float ra = 0.0, rb = 0.0;
            for (int x = -2; x <= 2; x++) {
              float L = pfxLuma(textureLod(tColor, (fc + vec2(x, y) * 2.0) / uFullSize, 0.0).rgb);
              ra += (3.0 - abs(float(x) + 0.25)) * L;
              rb += (3.0 - abs(float(x) - 0.25)) * L;
            }
            float wa = 3.0 - abs(float(y) + 0.25);
            float wb = 3.0 - abs(float(y) - 0.25);
            m0 += wa * ra; m1 += wa * rb; m2 += wb * ra; m3 += wb * rb;
          }
          const float TENT_NORM = 1.0 / 76.5625;         // (Σ weights)² = 8.75²
          float s0 = r0 * (1.0 - smoothstep(0.06, 0.6, m0 * TENT_NORM / max(l0, 1e-4)));
          float s1 = r1 * (1.0 - smoothstep(0.06, 0.6, m1 * TENT_NORM / max(l1, 1e-4)));
          float s2 = r2 * (1.0 - smoothstep(0.06, 0.6, m2 * TENT_NORM / max(l2, 1e-4)));
          float s3 = r3 * (1.0 - smoothstep(0.06, 0.6, m3 * TENT_NORM / max(l3, 1e-4)));
          // Removed from the gather: the amount the layer-aware colour average above holds.
          vec3 eGather = (c0 * (w0 * s0) + c1 * (w1 * s1) + c2 * (w2 * s2) + c3 * (w3 * s3)) / wsum;
          // Scattered as sprites: the footprint's true (box-filtered) energy. The layer-aware
          // weights dilate near-field specks to every texel they touch, so using them here
          // made the scattered energy depend on the grid phase (even/odd flicker when panning).
          vec3 eBox = (c0 * s0 + c1 * s1 + c2 * s2 + c3 * s3) * 0.25;
          vec3 eAll = (c0 * r0 + c1 * r1 + c2 * r2 + c3 * r3) * 0.25;
          float iso = clamp(pfxLuma(eBox) / max(pfxLuma(eAll), 1e-6), 0.0, 1.0);
          col -= eGather * spriteGate;
          hl = vec4(eBox * spriteGate, iso);
        }
      }
      outColorCoc = vec4(max(col, vec3(0.0)), kc * uScale);
      outHighlight = hl;
    }
  `};function wt(e){let t=Math.PI*(3-Math.sqrt(5)),n=new Float32Array(e*3);for(let r=0;r<e;r++){let i=Math.sqrt((r+.5)/e),a=r*t;n[r*3]=i*Math.cos(a),n[r*3+1]=i*Math.sin(a),n[r*3+2]=i}return n}function Tt(e){let t=wt(e),n=[];for(let r=0;r<e;r++)n.push(`vec2(${t[r*3].toFixed(6)}, ${t[r*3+1].toFixed(6)})`);return`const vec2 SMALL_KERNEL[${e}] = vec2[${e}](${n.join(`, `)});`}function Et(e){let t=wt(e),n=[];for(let r=0;r<e;r++)n.push(`vec3(${t[r*3].toFixed(6)}, ${t[r*3+1].toFixed(6)}, ${t[r*3+2].toFixed(6)})`);return`const vec3 KERNEL[${e}] = vec3[${e}](\n  ${n.join(`,
  `)}\n);`}function Dt(e=48){return{name:`LuminatiDofGather${e}`,defines:{TAPS:e},uniforms:{tColorCoc:{value:null},uTexel:{value:new C(1,1)},uRadius:{value:6}},vertexShader:vt,fragmentShader:`
      uniform sampler2D tColorCoc;
      uniform vec2 uTexel;
      uniform float uRadius;
      varying vec2 vUv;

      ${Et(e)}

      void main() {
        vec4 centre = textureLod(tColorCoc, vUv, 0.0);
        float coc0 = centre.a;
        const float MARGIN = 1.0;                         // disc edge softness (px)
        // background taps are weighted by the inverse area of the disc they scatter
        // (1/CoC², floored so a focused silhouette cannot dominate its blurred neighbours):
        // a less-blurred object in front of a blurrier background then spreads over it as
        // much as it blends inward, instead of keeping a crisp 'cut-out' silhouette
        const float MIN_AREA = 4.0;                       // (2 px)²
        float norm = uRadius * uRadius / float(TAPS);     // (tap area) / PI

        float c0p = max(coc0, 0.0);
        vec4 bg = vec4(centre.rgb, 1.0) / max(c0p * c0p, MIN_AREA);
        vec4 fg = vec4(0.0);
        float fgA = 0.0;
        float nc0 = -coc0;
        if (nc0 >= 1.0) {
          fg = vec4(centre.rgb, 1.0);
          fgA = norm / max(nc0 * nc0, norm);
        }

        for (int i = 0; i < TAPS; i++) {
          vec3 k = KERNEL[i];
          float d = k.z * uRadius;
          vec4 s = textureLod(tColorCoc, vUv + k.xy * (uRadius * uTexel), 0.0);

          // background / focus layer: limited by the smaller CoC of centre and tap
          float bc = max(min(coc0, s.a), 0.0);
          float bw = clamp((bc - d) / MARGIN + 1.0, 0.0, 1.0) / max(bc * bc, MIN_AREA);
          bg += vec4(s.rgb, 1.0) * bw;

          // near layer: scatter-as-gather with the tap's own CoC
          float nc = -s.a;
          float fw = clamp((nc - d) / MARGIN + 1.0, 0.0, 1.0) * step(1.0, nc);
          fg += vec4(s.rgb, 1.0) * fw;
          fgA += fw * norm / max(nc * nc, norm);
        }

        bg.rgb /= bg.a;
        fg.rgb /= max(fg.a, 1e-4);
        fgA = fg.a > 0.0 ? clamp(fgA, 0.0, 1.0) : 0.0;
        gl_FragColor = vec4(mix(bg.rgb, fg.rgb, fgA), fgA);
      }
    `}}var Ot={name:`LuminatiDofTent`,uniforms:{tBlur:{value:null},tColorCoc:{value:null},uSize:{value:new C(1,1)}},vertexShader:vt,fragmentShader:`
    uniform sampler2D tBlur;
    uniform sampler2D tColorCoc;
    uniform vec2 uSize;

    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      ivec2 mx = ivec2(uSize) - 1;
      vec4 c = texelFetch(tBlur, p, 0);
      float cc = texelFetch(tColorCoc, p, 0).a;
      float tol = 1.0 + 0.25 * abs(cc);
      vec4 acc = vec4(0.0);
      float wsum = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          ivec2 q = clamp(p + ivec2(x, y), ivec2(0), mx);
          vec4 s = texelFetch(tBlur, q, 0);
          float sc = texelFetch(tColorCoc, q, 0).a;
          float w = float((2 - abs(x)) * (2 - abs(y)));   // 1-2-1 tent
          float dd = (sc - cc) / tol;
          float sim = 1.0 / (1.0 + dd * dd * 4.0);
          // strict only next to (nearly) focused texels; two blurred layers blend freely
          sim = mix(sim, 1.0, smoothstep(1.0, 2.5, min(abs(cc), abs(sc))));
          w *= mix(sim, 1.0, max(s.a, c.a));
          acc += s * w;
          wsum += w;
        }
      }
      gl_FragColor = acc / wsum;
    }
  `},kt={name:`LuminatiDofBokehSprites`,uniforms:{tColorCoc:{value:null},tHighlight:{value:null},tGather:{value:null},uSize:{value:new C(1,1)},uMode:{value:0},uBoost:{value:1.5},uMaxRadius:{value:16},uMaxPointSize:{value:64}},vertexShader:`
    ${yt}
    uniform sampler2D tColorCoc;
    uniform sampler2D tHighlight;
    uniform vec2 uSize;
    uniform float uMode;
    uniform float uBoost;
    uniform float uMaxRadius;
    uniform float uMaxPointSize;
    flat out vec3 vColor;
    flat out float vRadius;
    flat out vec2 vCentre;

    void cull() {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // outside the clip volume
      gl_PointSize = 1.0;
      vColor = vec3(0.0); vRadius = 0.0; vCentre = vec2(0.0);
    }

    void main() {
      // one point per 2×2 block of reduced-res texels: energy-weighted merge
      int gw = (int(uSize.x) + 1) / 2;
      ivec2 base = ivec2(gl_VertexID % gw, gl_VertexID / gw) * 2;
      ivec2 mx = ivec2(uSize) - 1;
      vec3 esum = vec3(0.0);
      vec2 eCentre = vec2(0.0);
      float cocSum = 0.0, isoSum = 0.0, lsum = 0.0;
      for (int i = 0; i < 4; i++) {
        ivec2 t = min(base + ivec2(i & 1, i >> 1), mx);
        vec4 hl = texelFetch(tHighlight, t, 0);
        float l = pfxLuma(hl.rgb);
        if (l > 0.0) {
          esum += hl.rgb;
          eCentre += (vec2(t) + 0.5) * l;
          cocSum += texelFetch(tColorCoc, t, 0).a * l;
          isoSum += hl.a * l;
          lsum += l;
        }
      }
      if (lsum < 1e-5) { cull(); return; }
      eCentre /= lsum;
      float coc = cocSum / lsum;
      float iso = isoSum / lsum;
      float wNear = smoothstep(0.75, 1.5, -coc);
      float wm = uMode > 0.5 ? wNear : 1.0 - wNear;
      vec3 e = esum * wm;
      if (pfxLuma(e) < 1e-4) { cull(); return; }
      float r = clamp(abs(coc), 0.5, uMaxRadius);
      float size = min(2.0 * ceil(r + 1.5) + 1.0, uMaxPointSize);
      r = min(r, 0.5 * size - 1.5);
      float area = max(3.14159265 * r * r, 1.0);
      float gain = 1.0 + uBoost * 4.0 * iso * smoothstep(0.5, 3.0, r) * (1.0 + 0.1 * r);
      vColor = e * gain / area;
      vRadius = r;
      vCentre = eCentre;
      // snap the point centre to a pixel centre; the disc itself is evaluated around vCentre
      vec2 pc = floor(eCentre) + 0.5;
      gl_Position = vec4(pc / uSize * 2.0 - 1.0, 0.0, 1.0);
      gl_PointSize = size;
    }
  `,fragmentShader:`
    uniform sampler2D tColorCoc;
    uniform sampler2D tGather;
    uniform float uMode;
    flat in vec3 vColor;
    flat in float vRadius;
    flat in vec2 vCentre;

    void main() {
      float d = length(gl_FragCoord.xy - vCentre);
      float r = vRadius;
      float cov;
      if (uMode < 0.5) {
        ivec2 q = ivec2(gl_FragCoord.xy);
        float c0 = abs(texelFetch(tColorCoc, q, 0).a);
        float nearA = texelFetch(tGather, q, 0).a;
        float lim = max(min(c0, r), 0.5);
        cov = clamp(lim - d + 0.5, 0.0, 1.0) * (1.0 - nearA);
      } else {
        cov = clamp(r - d + 0.5, 0.0, 1.0);
      }
      if (cov <= 0.0) discard;
      // lens-like disc: flat body with a slightly brighter rim
      float rim = mix(0.9, 1.18, smoothstep(0.55, 1.0, d / max(r, 1.0)));
      gl_FragColor = vec4(vColor * (cov * rim), 0.0);
    }
  `},At={name:`LuminatiDofComposite`,uniforms:{tColor:{value:null},tBlur:{value:null},tColorCoc:{value:null},tNearBokeh:{value:null},uNearBokeh:{value:1},uHalfSize:{value:new C(1,1)},uHalfRatio:{value:new C(.5,.5)},uScale:{value:.5},uMaxCocPx:{value:10},uFullTexel:{value:new C(1,1)}},vertexShader:vt,fragmentShader:`
    ${St}
    ${yt}
    uniform sampler2D tColor;
    uniform sampler2D tBlur;
    uniform sampler2D tColorCoc;
    uniform sampler2D tNearBokeh;
    uniform float uNearBokeh;
    uniform vec2 uHalfSize;
    uniform vec2 uHalfRatio;
    uniform float uScale;
    uniform float uMaxCocPx;
    uniform vec2 uFullTexel;
    varying vec2 vUv;

    ${Tt(12)}

    void main() {
      ivec2 fp = ivec2(gl_FragCoord.xy);
      vec3 sharp = pfxSafe(texelFetch(tColor, fp, 0).rgb);
      float coc = dofCoC(texelFetch(tDepth, fp, 0).x, vUv.y);   // full-res px
      float cocH = coc * uScale;                                   // reduced-res px

      // CoC-aware bilinear upsample of the blurred layer
      vec2 hp = gl_FragCoord.xy * uHalfRatio - 0.5;
      vec2 f = fract(hp);
      ivec2 b = ivec2(floor(hp));
      ivec2 mx = ivec2(uHalfSize) - 1;
      ivec2 q0 = clamp(b, ivec2(0), mx);
      ivec2 q1 = clamp(b + ivec2(1, 0), ivec2(0), mx);
      ivec2 q2 = clamp(b + ivec2(0, 1), ivec2(0), mx);
      ivec2 q3 = clamp(b + ivec2(1, 1), ivec2(0), mx);
      vec4 s0 = texelFetch(tBlur, q0, 0);
      vec4 s1 = texelFetch(tBlur, q1, 0);
      vec4 s2 = texelFetch(tBlur, q2, 0);
      vec4 s3 = texelFetch(tBlur, q3, 0);
      vec4 tcs = vec4(texelFetch(tColorCoc, q0, 0).a, texelFetch(tColorCoc, q1, 0).a,
                      texelFetch(tColorCoc, q2, 0).a, texelFetch(tColorCoc, q3, 0).a);
      float tol = 1.0 + 0.25 * abs(cocH);
      vec4 dc = (tcs - cocH) / tol;
      vec4 sim = 1.0 / (1.0 + dc * dc * 4.0) + 1e-3;
      // CoC rejection only matters next to (nearly) focused texels (it keeps sharp colour from
      // leaking into blurred neighbours). Where both sides are already visibly blurred, plain
      // bilinear blending is right; rejecting there gave blurred mid-ground sprites a crisp,
      // pixel-exact 'cut-out' silhouette against a blurrier background. (Same rule in the tent.)
      sim = mix(sim, vec4(1.0), smoothstep(1.0, 2.5, min(vec4(abs(cocH)), abs(tcs))));
      vec4 bil = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
      vec4 w = bil * mix(sim, vec4(1.0), clamp(vec4(s0.a, s1.a, s2.a, s3.a), 0.0, 1.0));
      vec4 blur = (s0 * w.x + s1 * w.y + s2 * w.z + s3 * w.w) / max(dot(w, vec4(1.0)), 1e-5);

      // small CoCs: a full-resolution disc blur, so the focus falloff is gradual and the
      // half-res layer only takes over once the blur is large enough to hide its resolution
      float ac = abs(coc);
      vec3 base = sharp;
      if (ac > 0.3 && ac < 4.0) {
        // scatter-as-gather: a tap only counts if its own CoC reaches this pixel, so focused
        // silhouettes never smear onto a slightly blurred background next to them
        vec3 acc = sharp;
        float wsum = 1.0;
        ivec2 fmx = ivec2(uHalfSize / uHalfRatio + 0.5) - 1;
        for (int i = 0; i < 12; i++) {
          vec2 o = SMALL_KERNEL[i] * ac;
          vec2 pos = gl_FragCoord.xy + o;
          float tc = abs(dofCoC(texelFetch(tDepth, clamp(ivec2(pos), ivec2(0), fmx), 0).x, pos.y * uFullTexel.y));
          float wt = clamp(tc - length(o) + 1.0, 0.0, 1.0);
          acc += texture2D(tColor, pos * uFullTexel).rgb * wt;
          wsum += wt;
        }
        base = mix(sharp, acc / wsum, smoothstep(0.3, 1.2, ac));
      }
      float centreA = smoothstep(2.0, 4.0, ac);
      float a = 1.0 - (1.0 - centreA) * (1.0 - clamp(blur.a, 0.0, 1.0));
      vec3 nearBokeh = uNearBokeh > 0.5 ? texture2D(tNearBokeh, vUv).rgb : vec3(0.0);

#ifdef DEBUG
      float l = pfxLuma(sharp);
      vec3 dbase = vec3(sqrt(l / (1.0 + l))) * 0.45;
      float n = sqrt(clamp(-coc / uMaxCocPx, 0.0, 1.0));
      float fr = sqrt(clamp(coc / uMaxCocPx, 0.0, 1.0));
      float inFocus = 1.0 - smoothstep(0.25, 0.75, abs(coc));
      vec3 col = dbase;
      col = mix(col, vec3(1.0, 0.55, 0.12), n * 0.8);
      col = mix(col, vec3(0.22, 0.5, 1.0), fr * 0.8);
      col = mix(col, col * 0.5 + vec3(0.12, 0.5, 0.16), inFocus);
      float spill = clamp(blur.a, 0.0, 1.0) * step(-0.5, coc);
      col = mix(col, vec3(0.85, 0.2, 0.75), spill * 0.6);
      gl_FragColor = vec4(col, 1.0);
#else
      gl_FragColor = vec4(mix(base, blur.rgb, a) + nearBokeh, 1.0);
#endif
    }
  `},jt={name:`LuminatiGrade`,uniforms:{tDiffuse:{value:null},uTexel:{value:new C(1,1)},uAspect:{value:16/9},uExposure:{value:1},uContrast:{value:1.08},uSaturation:{value:1.12},uTemperature:{value:.08},uTint:{value:0},uShadowsTint:{value:new l(.02,.04,.08)},uHighlightsTint:{value:new l(.06,.03,-.02)},uVignette:{value:.5},uVignetteSoftness:{value:.55},uVignetteRoundness:{value:.65},uVignetteColor:{value:new l(.05,.025,.04)},uGrain:{value:.035},uGrainSize:{value:1},uGrainSeed:{value:0},uCA:{value:.0015},uSharpen:{value:.15},uDither:{value:1}},vertexShader:vt,fragmentShader:`
    ${yt}
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform float uAspect;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uTemperature;
    uniform float uTint;
    uniform vec3 uShadowsTint;
    uniform vec3 uHighlightsTint;
    uniform float uVignette;
    uniform float uVignetteSoftness;
    uniform float uVignetteRoundness;
    uniform vec3 uVignetteColor;
    uniform float uGrain;
    uniform float uGrainSize;
    uniform float uGrainSeed;
    uniform float uCA;
    uniform float uSharpen;
    uniform float uDither;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      // position relative to centre, x scaled toward the true aspect by 'roundness'
      vec2 d = uv - 0.5;
      vec2 dv = d * vec2(mix(1.0, uAspect, uVignetteRoundness), 1.0);
      float cornerLen = length(vec2(0.5 * mix(1.0, uAspect, uVignetteRoundness), 0.5));
      float r = length(dv) / cornerLen;            // 0 centre … 1 corners

      // --- sampling: sharpen + chromatic aberration
      vec3 c = texture2D(tDiffuse, uv).rgb;
      vec3 nb = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0)).rgb
              + texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0)).rgb
              + texture2D(tDiffuse, uv + vec2(0.0, uTexel.y)).rgb
              + texture2D(tDiffuse, uv - vec2(0.0, uTexel.y)).rgb;
      vec3 detail = clamp((c - nb * 0.25) * uSharpen, vec3(-0.08), vec3(0.08));
      vec3 col = c;
      if (uCA > 0.0) {
        vec2 off = d * (uCA * 2.0 * r * r);       // radial, grows toward the edges
        col.r = texture2D(tDiffuse, uv - off).r;
        col.b = texture2D(tDiffuse, uv + off).b;
      }
      col += detail;
      col = max(col, vec3(0.0));

      // --- exposure (post tone-map multiply)
      col *= uExposure;

      // --- white balance: warm/cool along blue↔amber, tint along green↔magenta, luma preserving
      vec3 wb = vec3(1.0 + 0.30 * uTemperature + 0.10 * uTint,
                     1.0 + 0.02 * uTemperature - 0.25 * uTint,
                     1.0 - 0.34 * uTemperature + 0.10 * uTint);
      wb /= pfxLuma(wb);
      col *= wb;

      // --- contrast around display mid-grey
      col = (col - 0.5) * uContrast + 0.5;
      col = max(col, vec3(0.0));

      // --- saturation
      float l = pfxLuma(col);
      col = max(mix(vec3(l), col, uSaturation), vec3(0.0));

      // --- split toning
      l = clamp(pfxLuma(col), 0.0, 1.0);
      float ws = (1.0 - l) * (1.0 - l);
      float wh = l * l;
      col += uShadowsTint * ws + uHighlightsTint * wh;

      // --- vignette (smooth, elliptical; darkens toward a deep warm brown instead of grey)
      float inner = mix(0.95, 0.05, clamp(uVignetteSoftness, 0.0, 1.0));
      float v = smoothstep(inner, 1.25, r);
      v = v * v * (3.0 - 2.0 * v);
      col = mix(col, uVignetteColor * col, clamp(uVignette * v * 1.35, 0.0, 1.0));

      // --- film grain: animated, strongest in the mid-tones
      vec2 gp = floor(gl_FragCoord.xy / uGrainSize);
      float g = pfxHash12(gp + uGrainSeed * vec2(113.7, 71.3)) + pfxHash12(gp * 1.37 + uGrainSeed * vec2(37.1, 91.9)) - 1.0;
      float lg = clamp(pfxLuma(col), 0.0, 1.0);
      float gw = 0.35 + 2.6 * lg * (1.0 - lg);
      col += g * uGrain * gw;

      // --- ordered dither (±0.5 LSB of 8-bit) against banding
      col += (pfxBayer8(gl_FragCoord.xy) - 0.5) * (uDither / 255.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `},Mt={name:`LuminatiBloomBrightPass`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:.82},smoothWidth:{value:.35},maxBrightness:{value:24}},vertexShader:vt,fragmentShader:`
    ${yt}
    uniform sampler2D tDiffuse;
    uniform float luminosityThreshold;
    uniform float smoothWidth;
    uniform float maxBrightness;
    varying vec2 vUv;

    void main() {
      vec3 c = pfxSafe(texture2D(tDiffuse, vUv).rgb);
      float br = max(c.r, max(c.g, c.b));
      float knee = max(smoothWidth, 1e-4);
      float soft = clamp(br - luminosityThreshold + knee, 0.0, 2.0 * knee);
      soft = soft * soft / (4.0 * knee);
      float contrib = max(soft, br - luminosityThreshold) / max(br, 1e-4);
      vec3 o = c * contrib;
      float m = max(o.r, max(o.g, o.b));
      o *= min(1.0, maxBrightness / max(m, 1e-4));
      gl_FragColor = vec4(o, 1.0);
    }
  `},Nt=[48,64,96];function Pt(e,t,n={}){return new D(e,t,{type:S,format:k,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1,minFilter:te,magFilter:te,...n})}function Ft(e,t=null,n=null,r={}){let i=j.clone(e.uniforms);return t&&Object.assign(i,t),new me({name:e.name,uniforms:i,defines:{...e.defines||{},...n||{}},vertexShader:e.vertexShader,fragmentShader:e.fragmentShader,glslVersion:e.glslVersion??null,depthTest:!1,depthWrite:!1,blending:0,toneMapped:!1,...r})}var It=class{constructor(e){this.gl=e,this.ext=e.getExtension?e.getExtension(`EXT_disjoint_timer_query_webgl2`):null,this.enabled=!1,this.results={},this.min={},this._pending=[],this._free=[],this._active=null}get supported(){return!!this.ext}begin(e){if(!this.enabled||!this.ext)return;this._active&&this.end();let t=this.gl,n=this._free.pop()||{q:t.createQuery(),label:``};n.label=e,t.beginQuery(this.ext.TIME_ELAPSED_EXT,n.q),this._active=n}end(){this._active&&=(this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this._pending.push(this._active),null)}poll(){if(!this.ext||this._pending.length===0)return;let e=this.gl,t=e.getParameter(this.ext.GPU_DISJOINT_EXT);for(;this._pending.length;){let n=this._pending[0];if(!e.getQueryParameter(n.q,e.QUERY_RESULT_AVAILABLE))break;let r=e.getQueryParameter(n.q,e.QUERY_RESULT);if(!t){let e=r/1e6,t=this.results[n.label];this.results[n.label]=t===void 0?e:t*.9+e*.1,this.min[n.label]=Math.min(this.min[n.label]??1/0,e)}this._pending.shift(),this._free.push(n)}}dispose(){let e=this.gl;this._active&&this.end();for(let t of this._pending)e.deleteQuery(t.q);for(let t of this._free)e.deleteQuery(t.q);this._pending.length=0,this._free.length=0}},Lt=class{constructor(e,t,n,i={}){this.renderer=e,this.scene=t,this.camera=n,this.samples=Math.max(0,i.samples??4)|0,this.dofScale=_(i.dofScale??.5,.25,1),this.maxTaps=Math.max(48,i.maxTaps??96),this.settings={enabled:!0,dof:{enabled:!0,focusDistance:24,focusRange:5,maxBlur:12,nearScale:1.4,farScale:1,tiltShift:.35,tiltCenter:.52,tiltWidth:.28,bokehBoost:1.5,autoFocus:!0,debug:!1,bokehThreshold:1.5,bokehSprites:!0,tiltFeather:.3,focusSpeed:4},bloom:{enabled:!0,strength:.55,radius:.55,threshold:.82,warmth:.25,knee:.35},grade:{enabled:!0,exposure:1,contrast:1.08,saturation:1.12,temperature:.08,tint:0,shadowsTint:[.02,.04,.08],highlightsTint:[.06,.03,-.02],vignette:.5,vignetteSoftness:.55,grain:.035,chromaticAberration:.0015,sharpen:.15,vignetteRoundness:.65,vignetteColor:[.05,.025,.04],grainSize:1,dither:1}},this._focusTarget=null,this._time=0,this._w=0,this._h=0,this._hw=0,this._hh=0,this._taps=Nt[0],this._v2=new C,this._clearColor=new F,this._bloomWarmth=-1,this._sceneInfo={calls:0,triangles:0,points:0,lines:0},this._depthTexture=new he(1,1,r),this._sceneRT=Pt(1,1,{samples:this.samples,depthBuffer:!0,depthTexture:this._depthTexture}),this._prefilterRT=Pt(1,1,{count:2}),this._gatherRT=Pt(1,1),this._tentRT=Pt(1,1),this._nearBokehRT=Pt(1,1),this._hdrRT=Pt(1,1),this._ldrRT=Pt(1,1),this._sceneRT.texture.name=`PostFX.scene`,this._prefilterRT.textures[0].name=`PostFX.dofColorCoc`,this._prefilterRT.textures[1].name=`PostFX.dofHighlights`,this._gatherRT.texture.name=`PostFX.dofGather`,this._tentRT.texture.name=`PostFX.dofBlur`,this._nearBokehRT.texture.name=`PostFX.dofNearBokeh`,this._hdrRT.texture.name=`PostFX.hdr`,this._ldrRT.texture.name=`PostFX.ldr`,this._coc=xt(),this._prefilterMat=Ft(Ct,this._coc),this._gatherMats=new Map,this._tentMat=Ft(Ot),this._spriteMat=Ft(kt,null,null,{blending:5,blendEquation:100,blendSrc:201,blendDst:201,transparent:!0}),this._compositeMat=Ft(At,this._coc),this._debugMat=Ft(At,this._coc,{DEBUG:1}),this._gradeMat=Ft(jt),this._copyMat=Ft(bt),this._quad=new ft(null),this._spriteGeo=new fe,this._spriteCapacity=0,this._sprites=new ke(this._spriteGeo,this._spriteMat),this._sprites.frustumCulled=!1,this._spriteCam=new le(-1,1,1,-1,0,1);let a=e.getContext(),o=a.getParameter(a.ALIASED_POINT_SIZE_RANGE);this._spriteMat.uniforms.uMaxPointSize.value=Math.max(1,Math.min(256,o?o[1]:64));let s=this.settings.bloom;this._bloom=new ht(new C(2,2),s.strength,s.radius,s.threshold);let c=Ft(Mt);this._bloom.materialHighPassFilter.dispose(),this._bloom.materialHighPassFilter=c,this._bloom.highPassUniforms=c.uniforms,this._output=new _t,this._timer=new It(a),e.getDrawingBufferSize(this._v2),this._allocate(Math.max(1,this._v2.x),Math.max(1,this._v2.y))}setSize(e,t,n=this.renderer.getPixelRatio()){let r=Math.max(1,Math.floor(e*n)),i=Math.max(1,Math.floor(t*n));(r!==this._w||i!==this._h)&&this._allocate(r,i)}setFocus(e,t=!1){Number.isFinite(e)&&(this._focusTarget=e,t&&this.settings.dof.autoFocus&&(this.settings.dof.focusDistance=e))}get depthTexture(){return this._depthTexture}get sceneTarget(){return this._sceneRT}get size(){return{width:this._w,height:this._h,dofWidth:this._hw,dofHeight:this._hh}}get taps(){return this._taps}get timings(){return this._timer.results}get timingsMin(){return this._timer.min}enableTimings(e=!0){return this._timer.enabled=!!e&&this._timer.supported,this._timer.enabled&&(this._timer.min={},this._timer.results={}),this._timer.enabled}render(e=1/60){let t=this.renderer,n=this.settings;e=Number.isFinite(e)?Math.min(Math.max(e,0),.25):1/60,this._time+=e;let r=n.dof;if(r.autoFocus&&this._focusTarget!==null&&(r.focusDistance+=(this._focusTarget-r.focusDistance)*O(r.focusSpeed??4,e)),!n.enabled){t.setRenderTarget(null),this._renderScene();return}t.getDrawingBufferSize(this._v2),(this._v2.x!==this._w||this._v2.y!==this._h)&&this._allocate(this._v2.x,this._v2.y);let i=this._timer;i.poll(),i.begin(`scene`),t.setRenderTarget(this._sceneRT),t.autoClear||t.clear(),this._renderScene(),i.end();let a=t.autoClear;t.autoClear=!1;let o=this._sceneRT,s=!!r.debug;if(r.enabled||s){if(i.begin(`dof`),this._renderDof(s),i.end(),s){t.autoClear=a;return}o=this._hdrRT}n.bloom.enabled&&n.bloom.strength>0&&(i.begin(`bloom`),o===this._sceneRT&&(this._copyMat.uniforms.tDiffuse.value=this._sceneRT.texture,this._blit(this._copyMat,this._hdrRT),o=this._hdrRT),this._updateBloom(),this._bloom.render(t,null,o,e,!1),i.end()),i.begin(`output`);let c=n.grade.enabled;this._output.renderToScreen=!c,this._output.render(t,this._ldrRT,o),c&&(this._updateGrade(),this._gradeMat.uniforms.tDiffuse.value=this._ldrRT.texture,this._blit(this._gradeMat,null)),i.end(),t.autoClear=a}warmup(){let e=this.renderer,t=e.getRenderTarget(),n=e.autoClear;e.autoClear=!1;for(let e of Nt)e<=this.maxTaps&&this._blit(this._gatherMaterial(e),this._gatherRT);for(let e of[this._prefilterMat,this._tentMat,this._compositeMat,this._debugMat,this._gradeMat,this._copyMat]){let t=e===this._prefilterMat?this._prefilterRT:e===this._gradeMat||e===this._debugMat?null:this._hdrRT;this._blit(e,t)}e.setRenderTarget(this._tentRT),e.render(this._sprites,this._spriteCam),this._updateBloom(),this._bloom.render(e,null,this._hdrRT,0,!1),this._output.renderToScreen=!1,this._output.render(e,this._ldrRT,this._hdrRT),e.autoClear=n,e.setRenderTarget(t)}get sceneInfo(){return this._sceneInfo}dispose(){for(let e of[this._sceneRT,this._prefilterRT,this._gatherRT,this._tentRT,this._nearBokehRT,this._hdrRT,this._ldrRT])e.dispose();this._depthTexture.dispose(),this._prefilterMat.dispose();for(let e of this._gatherMats.values())e.dispose();this._gatherMats.clear();for(let e of[this._tentMat,this._spriteMat,this._compositeMat,this._debugMat,this._gradeMat,this._copyMat])e.dispose();this._spriteGeo.dispose(),this._quad.dispose(),this._bloom.dispose(),this._output.dispose(),this._timer.dispose()}_allocate(e,n){e=Math.max(1,e|0),n=Math.max(1,n|0),this._w=e,this._h=n;let r=Math.max(1,Math.ceil(e*this.dofScale)),i=Math.max(1,Math.ceil(n*this.dofScale));this._hw=r,this._hh=i,this._sceneRT.setSize(e,n),this._hdrRT.setSize(e,n),this._ldrRT.setSize(e,n);for(let e of[this._prefilterRT,this._gatherRT,this._tentRT,this._nearBokehRT])e.setSize(r,i);this._bloom.setSize(e,n);let a=Math.ceil(r/2)*Math.ceil(i/2);a>this._spriteCapacity&&(this._spriteCapacity=Math.ceil(a*1.25),this._spriteGeo.dispose(),this._spriteGeo.setAttribute(`position`,new t(new Uint8Array(this._spriteCapacity),1)),this._spriteGeo.boundingSphere=new se(new l,1),this._spriteGeo.boundingBox=new ie(new l(-1,-1,-1),new l(1,1,1))),this._spriteGeo.setDrawRange(0,a);let o=this._prefilterMat.uniforms;o.uFullSize.value.set(e,n),o.uRatio.value.set(e/r,n/i),o.uScale.value=this.dofScale,this._tentMat.uniforms.uSize.value.set(r,i),this._spriteMat.uniforms.uSize.value.set(r,i);for(let t of[this._compositeMat,this._debugMat])t.uniforms.uHalfSize.value.set(r,i),t.uniforms.uHalfRatio.value.set(r/e,i/n),t.uniforms.uScale.value=this.dofScale,t.uniforms.uFullTexel.value.set(1/e,1/n);this._gradeMat.uniforms.uTexel.value.set(1/e,1/n),this._gradeMat.uniforms.uAspect.value=e/n}_renderScene(){let e=this.renderer.info,t=e.render,n=e.autoReset,r=n?0:t.calls,i=n?0:t.triangles,a=n?0:t.points,o=n?0:t.lines;this.renderer.render(this.scene,this.camera);let s=this._sceneInfo;s.calls=t.calls-r,s.triangles=t.triangles-i,s.points=t.points-a,s.lines=t.lines-o}_gatherMaterial(e){let t=this._gatherMats.get(e);return t||(t=Ft(Dt(e)),this._gatherMats.set(e,t)),t}_blit(e,t){this._quad.material=e,this.renderer.setRenderTarget(t),this._quad.render(this.renderer)}_clear(e){let t=this.renderer;t.getClearColor(this._clearColor);let n=t.getClearAlpha();t.setRenderTarget(e),t.setClearColor(0,0),t.clear(!0,!1,!1),t.setClearColor(this._clearColor,n)}_renderDof(e){let t=this.settings.dof,n=this.camera,r=this._coc,i=this.renderer,a=Math.max(0,t.maxBlur)*(this._h/1080);r.tDepth.value=this._depthTexture,r.uCamNear.value=n.near,r.uCamFar.value=n.far,r.uFocusDistance.value=t.focusDistance,r.uFocusRange.value=Math.max(.01,t.focusRange),r.uNearScale.value=Math.max(0,t.nearScale),r.uFarScale.value=Math.max(0,t.farScale),r.uMaxBlurPx.value=a,r.uTilt.value.set(Math.max(0,t.tiltShift),t.tiltCenter,Math.max(0,t.tiltWidth)),r.uTiltFeather.value=Math.max(.01,t.tiltFeather??.3),r.uOrtho.value=+!!n.isOrthographicCamera;let o=Math.max(t.nearScale,t.farScale,t.tiltShift,0),s=Math.max(1,a*o*this.dofScale),c=.3*Math.PI*s*s,l=Nt[0];for(let e=0;e<Nt.length;e++){let t=Nt[e];if(t>this.maxTaps||(l=t,t>=c))break}this._taps=l;let u=t.bokehSprites!==!1&&!e,d=Math.max(.001,i.toneMappingExposure||1),f=this._prefilterRT.textures[0],p=this._prefilterRT.textures[1],m=this._prefilterMat.uniforms;m.tColor.value=this._sceneRT.texture,m.uBokehThreshold.value=Math.max(.05,t.bokehThreshold??1.5)/d,m.uSprites.value=+!!u,this._blit(this._prefilterMat,this._prefilterRT);let h=this._gatherMaterial(l);h.uniforms.tColorCoc.value=f,h.uniforms.uTexel.value.set(1/this._hw,1/this._hh),h.uniforms.uRadius.value=s,this._blit(h,this._gatherRT);let g=this._tentMat.uniforms;if(g.tBlur.value=this._gatherRT.texture,g.tColorCoc.value=f,this._blit(this._tentMat,this._tentRT),u){let e=this._spriteMat.uniforms;e.tColorCoc.value=f,e.tHighlight.value=p,e.tGather.value=this._gatherRT.texture,e.uBoost.value=Math.max(0,t.bokehBoost),e.uMaxRadius.value=s,e.uMode.value=0,i.setRenderTarget(this._tentRT),i.render(this._sprites,this._spriteCam),e.uMode.value=1,this._clear(this._nearBokehRT),i.render(this._sprites,this._spriteCam)}let _=e?this._debugMat:this._compositeMat;_.uniforms.tColor.value=this._sceneRT.texture,_.uniforms.tBlur.value=this._tentRT.texture,_.uniforms.tColorCoc.value=f,_.uniforms.tNearBokeh.value=this._nearBokehRT.texture,_.uniforms.uNearBokeh.value=+!!u,_.uniforms.uMaxCocPx.value=Math.max(1,a*o),this._blit(_,e?null:this._hdrRT)}_updateBloom(){let e=this.settings.bloom,t=this._bloom;t.strength=e.strength,t.radius=e.radius,t.threshold=e.threshold,t.highPassUniforms.smoothWidth.value=Math.max(.01,e.knee??.35);let n=e.warmth??0;if(n!==this._bloomWarmth){this._bloomWarmth=n;let e=t.bloomTintColors.length;for(let r=0;r<e;r++){let i=_(n*(.35+.65*(r/Math.max(1,e-1))),0,1);t.bloomTintColors[r].set(1+.08*i,1-.1*i,1-.32*i)}}}_updateGrade(){let e=this.settings.grade,t=this._gradeMat.uniforms;t.uExposure.value=e.exposure,t.uContrast.value=e.contrast,t.uSaturation.value=e.saturation,t.uTemperature.value=e.temperature,t.uTint.value=e.tint,t.uShadowsTint.value.fromArray(e.shadowsTint),t.uHighlightsTint.value.fromArray(e.highlightsTint),t.uVignette.value=e.vignette,t.uVignetteSoftness.value=e.vignetteSoftness,t.uVignetteRoundness.value=e.vignetteRoundness??.65,e.vignetteColor&&t.uVignetteColor.value.fromArray(e.vignetteColor),t.uGrain.value=e.grain,t.uGrainSize.value=Math.max(1,e.grainSize??1),t.uGrainSeed.value=Math.floor(this._time*24)%997,t.uCA.value=e.chromaticAberration,t.uSharpen.value=e.sharpen,t.uDither.value=e.dither??1}},z=o(P.outline),Rt=`#8a7a6a`,zt=/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;function Bt(e,t=Rt){if(e==null||e===!1)return t;if(typeof e==`number`&&Number.isFinite(e))return`#${(e>>>0&16777215).toString(16).padStart(6,`0`)}`;if(e&&e.isColor)return`#${e.getHexString()}`;if(Array.isArray(e)&&e.length>=3&&typeof e[0]==`number`)return e;if(typeof e==`string`){let t=xe(P,e);if(typeof t==`string`)return t;if(Array.isArray(t))return t[Math.floor(t.length/2)];if(zt.test(e.trim()))return e.trim();let n=xe(F.NAMES,e.trim().toLowerCase());if(n!==void 0)return`#${n.toString(16).padStart(6,`0`)}`}return t}function Vt(e,{base:t}={}){let n=null;if(Array.isArray(e)&&e.length&&typeof e[0]!=`number`?n=e:typeof e==`string`&&Array.isArray(P[e])&&(n=P[e]),!n){let t=Bt(e);return[-.62,-.3,0,.24,.46].map(e=>e===0?[...o(t)]:M(t,e))}let r=n.length,i=t??(r>=6?3:2);i<0&&(i=r+i);let a=[];for(let e=-2;e<=2;e++){let t=i+e;t<0?a.push(M(n[0],-.22*-t)):t>=r?a.push(M(n[r-1],.16*(t-r+1))):a.push([...o(n[t])])}return a}var Ht=204;function Ut(e){return[e[0],e[1],e[2],Ht]}function Wt(e,t){if(typeof e==`string`&&Array.isArray(P[e])){let n=P[e].length;if(t===`skin`)return Vt(e,{base:n-2});if(t===`hair`&&e===`hairBlack`||t===`hair`&&e===`hairWhite`||e===`white`||e===`cream`||e===`black`)return Vt(e,{base:3})}return Vt(e)}var B={SKIN:1,HAIR:2,TOP:3,BOTTOM:4,ACCENT:5,CAPE:6,CAPEIN:7,HAT:8,BOOT:9,METAL:10,WOOD:11,GOLD:12,LEATHER:13,EYE:14,WHITE:15,SHIRT:16,SCARF:17,BLUSH:18,LINE:19,BEARD:20,PACK:21,GEM:22,STRING:23,FEATHER:24,BOOK:25,HATBAND:26,BELT:27,SASH:28,FUR:29,FUR2:30,FUR3:31,BEAK:32,COMB:33,NOSE:34,GEL:35,BONE:36,GLOW:37,STONE:38,WING:39},Gt=40,Kt=class{constructor(e,t){this.w=e,this.h=t,this.mat=new Uint8Array(e*t),this.shade=new Int8Array(e*t),this.part=new Uint16Array(e*t),this.pid=0,this.line=null,this.lineShade=0,this.ox=0,this.oy=0,this.minX=0,this.minY=0,this.maxX=-1,this.maxY=-1}clear(){return this.mat.fill(0),this.shade.fill(0),this.part.fill(0),this.pid=0,this}begin(e=null,t=0){this.pid++,this.line=e,this.lineShade=t,this.minX=this.w,this.minY=this.h,this.maxX=-1,this.maxY=-1}end(){let e=Jt[this.line];if(!e||this.maxX<0)return;let{w:t,h:n,mat:r,part:i,shade:a,pid:o}=this,s=[];for(let a=this.minY;a<=this.maxY;a++)for(let c=this.minX;c<=this.maxX;c++){let l=a*t+c;if(i[l]===o&&r[l])for(let[l,u]of e){let e=c+l,d=a+u;if(e<0||d<0||e>=t||d>=n)continue;let f=d*t+e;r[f]&&i[f]!==o&&r[f]!==B.EYE&&r[f]!==B.LINE&&s.push(f)}}for(let e of s)a[e]>this.lineShade&&(a[e]=this.lineShade)}set(e,t,n,r=2){if(e=(e|0)+this.ox,t=(t|0)+this.oy,e<0||t<0||e>=this.w||t>=this.h)return;let i=t*this.w+e;this.mat[i]=n,this.shade[i]=r,this.part[i]=this.pid,e<this.minX&&(this.minX=e),t<this.minY&&(this.minY=t),e>this.maxX&&(this.maxX=e),t>this.maxY&&(this.maxY=t)}get(e,t){return e=(e|0)+this.ox,t=(t|0)+this.oy,e<0||t<0||e>=this.w||t>=this.h?0:this.mat[t*this.w+e]}getShade(e,t){return e=(e|0)+this.ox,t=(t|0)+this.oy,e<0||t<0||e>=this.w||t>=this.h?0:this.shade[t*this.w+e]}tone(e,t,n){if(e=(e|0)+this.ox,t=(t|0)+this.oy,e<0||t<0||e>=this.w||t>=this.h)return;let r=t*this.w+e;this.mat[r]&&(this.shade[r]=Math.max(0,Math.min(4,this.shade[r]+n)))}over(e,t,n,r){this.get(e,t)&&this.set(e,t,n,r)}rect(e,t,n,r,i,a=2){for(let o=t;o<t+r;o++)for(let t=e;t<e+n;t++)this.set(t,o,i,a)}hline(e,t,n,r,i=2){t<e&&([e,t]=[t,e]);for(let a=e;a<=t;a++)this.set(a,n,r,i)}vline(e,t,n,r,i=2){n<t&&([t,n]=[n,t]);for(let a=t;a<=n;a++)this.set(e,a,r,i)}line2(e,t,n,r,i,a=2){e=Math.round(e),t=Math.round(t),n=Math.round(n),r=Math.round(r);let o=Math.abs(n-e),s=-Math.abs(r-t),c=e<n?1:-1,l=t<r?1:-1,u=o+s,d=Math.max(o,-s)||1,f=0;for(;this.set(e,t,i,typeof a==`function`?a(f/d,e,t):a),e!==n||t!==r;){let n=2*u;n>=s&&(u+=s,e+=c),n<=o&&(u+=o,t+=l),f++}}tpl(e,t,n,r=null){let i=r||e.legend,a=e.rows;for(let r=0;r<a.length;r++){let o=a[r];for(let a=0;a<o.length;a++){let s=o[a];if(s===`.`||s===` `)continue;let c=i[s];if(c){if(c===qt){this.erase(t+(e.ox||0)+a,n+(e.oy||0)+r);continue}this.set(t+(e.ox||0)+a,n+(e.oy||0)+r,c[0],c[1])}}}}erase(e,t){if(e=(e|0)+this.ox,t=(t|0)+this.oy,e<0||t<0||e>=this.w||t>=this.h)return;let n=t*this.w+e;this.mat[n]=0,this.part[n]=0}},qt=Object.freeze([`erase`]),Jt={all:[[1,0],[-1,0],[0,1],[0,-1]],below:[[0,1]],above:[[0,-1]],sides:[[1,0],[-1,0]],belowSides:[[1,0],[-1,0],[0,1]]};function Yt(e,t,n,r,i,a=!1,{outline:o=!0}={}){let{w:s,h:c,mat:l,shade:u}=e;for(let e=0;e<c;e++)for(let d=0;d<s;d++){let f=e*s+d,p=r+(a?s-1-d:d),m=i+e,h=l[f];if(h){let e=t[h]||t[B.TOP];n.set(p,m,e[Math.max(0,Math.min(4,u[f]))])}else if(o){let t=d>0&&l[f-1],r=d<s-1&&l[f+1],i=e>0&&l[f-s],a=e<c-1&&l[f+s];(t||r||i||a)&&n.set(p,m,z)}}}var Xt={d:[B.SKIN,0],s:[B.SKIN,1],m:[B.SKIN,2],l:[B.SKIN,3],L:[B.SKIN,4]},V={1:[B.HAIR,0],2:[B.HAIR,1],3:[B.HAIR,2],4:[B.HAIR,3],5:[B.HAIR,4],x:qt},Zt={1:[B.BEARD,0],2:[B.BEARD,1],3:[B.BEARD,2],4:[B.BEARD,3],5:[B.BEARD,4],s:[B.SKIN,1]},H={1:[B.HAT,0],2:[B.HAT,1],3:[B.HAT,2],4:[B.HAT,3],5:[B.HAT,4],a:[B.HATBAND,0],b:[B.HATBAND,1],c:[B.HATBAND,2],d:[B.HATBAND,3],g:[B.GOLD,1],G:[B.GOLD,3],h:[B.GOLD,4],j:[B.GEM,2],J:[B.GEM,4],f:[B.FEATHER,1],F:[B.FEATHER,3],e:[B.FEATHER,4],k:[B.HAT,0],x:qt,m:[B.SKIN,2],s:[B.SKIN,1],S:[B.SKIN,0],9:[B.HAIR,2],8:[B.HAIR,1]},U=(e,t,n=0,r=0)=>({rows:e,legend:t,ox:n,oy:r}),Qt={down:U([`............`,`...mmmmmm...`,`..mmmmmmmm..`,`.mmmmmmmmmm.`,`.mmmmmmmmms.`,`smmmmmmmmmss`,`smmmmmmmmmss`,`.mmmmmmmmms.`,`.lmmmmmmmss.`,`..mmmmmmss..`,`...mmssss...`],Xt),side:U([`............`,`....mmmmmm..`,`..mmmmmmmmm.`,`.mmmmmmmmmmm`,`.mmmmmmmmmms`,`.mmmmmmmmmss`,`.mmmmmmmmmss`,`mmmmmmmmmss.`,`.mmmmmmmss..`,`..mmmmsss...`,`...mss......`],Xt),up:U([`............`,`...mmmmmm...`,`..mmmmmmmm..`,`.mmmmmmmmmm.`,`.mmmmmmmmms.`,`smmmmmmmmmss`,`smmmmmmmmmss`,`.mmmmmmmmms.`,`..mmmmmmss..`,`...smmmss...`,`....ssss....`],Xt)},$t={short:{down:{front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.344433333222.`,`.333233233322.`,`.33.33.23..22.`,`.32........22.`,`.2..........1.`],V,-1,-1)},side:{front:U([`.....33443....`,`...334444433..`,`..33455443332.`,`.3445543333322`,`.3443333333222`,`.33.3.33333222`,`.3......333222`,`........332221`,`........33221.`,`.........221..`],V,-1,-1)},up:{front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.344443333322.`,`.343343333222.`,`.333332333222.`,`.233333323221.`,`.223333332221.`,`..2223332221..`,`...22222211...`],V,-1,-1)}},spiky:{down:{front:U([`...3.....4....`,`...43..3.43...`,`..3443344433..`,`.3344554443322`,`3334554433322.`,`.334433333322.`,`.3343332333222`,`.33.33.23.322.`,`.32...3....2..`,`.2..........1.`],V,-1,-2)},side:{front:U([`.....3.4......`,`....343433.3..`,`...334444333..`,`..33455443332.`,`.3345543333322`,`.3343333332222`,`.33.3.33332222`,`.3......333222`,`........332221`,`........33221.`,`.........221..`],V,-1,-2)},up:{front:U([`...3.....3....`,`...33..3.33...`,`..3343334333..`,`.3334443333322`,`3333443333322.`,`.334433333222.`,`.343343333222.`,`.333332333222.`,`.233333323221.`,`.223333332221.`,`..2223332221..`,`...22222211...`],V,-1,-2)}},long:{down:{swayFrom:12,front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.3444433.3222.`,`.34433.3..322.`,`3343.......322`,`343.........22`,`343.........21`,`33..........21`,`343........321`,`343........221`,`.33........22.`,`.32........21.`,`..2........1..`],V,-1,-1),back:U([`.333333333322.`,`.333333333322.`,`.233333333221.`,`..2222222221..`],V,-1,9)},side:{swayFrom:11,front:U([`.....33443....`,`...334444433..`,`..33455443332.`,`.3445543333322`,`.3443333333222`,`.33.3.33433222`,`.3.....3433222`,`.......3433221`,`.......3333221`,`.......3332221`,`.......3332221`,`.......3332221`,`.......233221.`,`........2321..`,`........221...`],V,-1,-1)},up:{swayFrom:12,front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.344443333322.`,`.344343333222.`,`33433323332221`,`34433323332221`,`34333323332221`,`33433323322221`,`33433233322221`,`33333233322221`,`.2333233322211`,`.233223232221.`,`..22.22.221...`],V,-1,-1)}},ponytail:{down:{front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.344433333222.`,`.33.3.32..222.`,`.3..........2.`,`.2..........1.`],V,-1,-1)},side:{front:U([`.....33443....`,`...334444433..`,`..33455443332.`,`.3445543333322`,`.3443333333222`,`.3..3.3333222.`,`.3......3322..`,`........322...`],V,-1,-1)},up:{front:U([`.....3443.....`,`...33444433...`,`..3345544333..`,`.334554433322.`,`.344443333322.`,`.343343333222.`,`.233332333221.`,`..2333323221..`,`...22333221...`],V,-1,-1)}},bun:{down:{front:U([`.....3443.....`,`....345542....`,`...33244233...`,`..3345544333..`,`.334554433322.`,`.344433333222.`,`.3332333.3322.`,`.3..3.....2...`,`.2..........1.`],V,-1,-2)},side:{front:U([`............343.`,`.....33443324543`,`...3344444334332`,`..3345544333222.`,`.3445543333322..`,`.3443333333222..`,`.33.3.3333222...`,`.3......3322....`,`........322.....`],V,-1,-2)},up:{front:U([`....345543....`,`....344432....`,`....233322....`,`..3344433332..`,`.334454333322.`,`.344433333222.`,`.333333323222.`,`.233332333221.`,`..2333323221..`,`...22333221...`],V,-1,-2)}},bald:{down:{front:U([`.4..........3.`,`.43........32.`,`.33........22.`,`.32........21.`,`.2..........1.`],V,-1,3)},side:{front:U([`.........332.`,`........33221`,`........3222.`,`.........21..`],V,-1,5)},up:{front:U([`.4..........3.`,`.43........32.`,`.343333333322.`,`.233332333221.`,`..2223332221..`,`...22222211...`],V,-1,3)}}},en={full:{down:U([`.3........2.`,`.34.4433.32.`,`.3445ss5432.`,`..44433332..`,`..34433322..`,`...343322...`,`....3322....`,`.....21.....`],{...Zt,s:[B.BEARD,0]},0,6),side:U([`.....2......`,`.44..32.....`,`.4433332....`,`.344332.....`,`.34433......`,`..3432......`,`..332.......`,`...2........`],Zt,0,7)},mustache:{down:U([`...443342...`,`...3.22.2...`],Zt,0,8),side:U([`443.........`,`.3..........`],Zt,0,8)},goatee:{down:U([`....4432....`,`.....32.....`],Zt,0,9),side:U([`.44.........`,`.32.........`],Zt,0,9)}},tn={hood:{down:U([`......44......`,`....344332....`,`...34444332...`,`..3445433322..`,`.344333333322.`,`.3431111111222`,`.341........22`,`342.........22`,`342.........21`,`332.........21`,`332.........21`,`3321.......221`,`33321.....2221`,`.333222222222.`],H,-1,-2),side:U([`.......444....`,`.....3443332..`,`...344443332..`,`..34544333322.`,`..34433333322.`,`.3431113333222`,`.3..1..3333222`,`.3.....3333222`,`.......3332222`,`.......3332221`,`.......3332221`,`......23332221`,`.....233332221`,`....2333332221`],H,-1,-2),up:U([`......44......`,`....344332....`,`...34444332...`,`..3445433322..`,`.344333333322.`,`.3443333333222`,`.3433333333222`,`33433333323222`,`33333333323222`,`33333333323221`,`33333333323221`,`33233333232221`,`32233333232221`,`.222222222221.`],H,-1,-2)},wide:{down:U([`......34433.......`,`.....3444433......`,`....aabbbbcca.....`,`..3344444443332...`,`3344444433333322..`,`.22222222222221...`],H,-3,-2),side:U([`.....34433........`,`....3444433.......`,`...aabbbbcca......`,`.334444444333322..`,`334444443333332221`,`.2222222222222211.`],H,-3,-2),up:U([`......33332.......`,`.....3443332......`,`....aabbbbcca.....`,`..3344443333322...`,`3344443333333222..`,`.22222222222221...`],H,-3,-2)},cap:{down:U([`.....33333...eF...`,`...3344443332fF...`,`..33445443333322..`,`..3444433333332...`,`..aabbbbbbbbca....`],H,-3,-2),side:U([`.....33333..eF....`,`...33444433fF.....`,`..3445443333332...`,`..34443333333322..`,`..abbbbbbbbba2....`],H,-3,-2),up:U([`.....33333....eF..`,`...3344433332fF...`,`..33443333333322..`,`..3443333333332...`,`..aabbbbbbbbca....`],H,-3,-2)},helmet:{down:U([`....GhGGgg....`,`...33445332...`,`..3445543322..`,`.334544333222.`,`.344443333222.`,`dccccccccccbba`,`.2.....g....2.`,`.2..........2.`,`.1..........1.`],{...H,1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3],5:[B.METAL,4],a:[B.METAL,0],b:[B.METAL,1],c:[B.METAL,2],d:[B.METAL,3]},-1,-2),side:U([`.....GhGgg....`,`....3344533...`,`...34455333...`,`..3445433332..`,`..34443333322.`,`.dccccccccbbba`,`.........22222`,`.........2322.`,`.........122..`],{...H,1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3],5:[B.METAL,4],a:[B.METAL,0],b:[B.METAL,1],c:[B.METAL,2],d:[B.METAL,3]},-1,-2),up:U([`....GhGGgg....`,`...33445332...`,`..3445433322..`,`.334433333222.`,`.343333333222.`,`dccccccccccbba`,`.2222222222222`,`.2333333333322`,`.1222222222211`],{...H,1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3],5:[B.METAL,4],a:[B.METAL,0],b:[B.METAL,1],c:[B.METAL,2],d:[B.METAL,3]},-1,-2)},circlet:{down:U([`.GGGGhjgggg.`],H,0,3),side:U([`.GGhGggggg..`],H,0,3),up:U([`.ggggggggGg.`],H,0,3)}},nn={traveler:{skin:`skinLight`,hair:`hairBrown`,hairStyle:`short`,outfit:{top:`#2f9a92`,bottom:`#4a4a5e`,accent:`wood`,style:`tunic`,shirt:`cream`},cape:{color:`#a0703f`,style:`cloak`,lining:`#5a3a2a`},hat:`none`,weapon:`none`,beard:!1,gear:{satchel:!0,boots:`#4a3428`,leather:`#6a4428`},eyes:`green`},swordsman:{skin:`skinTan`,hair:`hairBlack`,hairStyle:`spiky`,outfit:{top:`#39445e`,bottom:`brown`,accent:`metal`,style:`tunic`,shirt:`cream`},cape:!1,hat:`none`,weapon:`sword`,beard:!1,gear:{scarf:`red`,pauldrons:!0,bracers:!0,boots:`black`},eyes:`brown`},merchant:{skin:`skinLight`,hair:`hairRed`,hairStyle:`short`,outfit:{top:`green`,bottom:`#6b4a34`,accent:`gold`,style:`vest`,shirt:`cream`},cape:!1,hat:`wide`,hatColor:`#7a5a3c`,hatBand:`red`,weapon:`none`,beard:`mustache`,gear:{pack:!0,boots:`brown`},build:`stout`,eyes:`brown`},cleric:{skin:`skinLight`,hair:`hairBlonde`,hairStyle:`long`,outfit:{top:`white`,bottom:`white`,accent:`blue`,style:`robe`,shirt:`white`},cape:!1,hat:`circlet`,weapon:`staff`,beard:!1,gear:{boots:`cream`,sash:`gold`,staffGem:`blue`},eyes:`blue`,blush:!0},scholar:{skin:`skinLight`,hair:`hairWhite`,hairStyle:`short`,outfit:{top:`purple`,bottom:`purple`,accent:`gold`,style:`robe`,shirt:`cream`},cape:!1,hat:`none`,weapon:`none`,beard:`goatee`,gear:{glasses:!0,book:!0,boots:`brown`},eyes:`blue`},dancer:{skin:`skinTan`,hair:`hairBlack`,hairStyle:`ponytail`,outfit:{top:`red`,bottom:`red`,accent:`gold`,style:`dancer`,shirt:`gold`},cape:!1,hat:`circlet`,weapon:`none`,beard:!1,gear:{sashes:!0,boots:`gold`},eyes:`brown`,blush:!0,female:!0},hunter:{skin:`skinTan`,hair:`hairBlonde`,hairStyle:`short`,outfit:{top:`#7a5a38`,bottom:`#3f4a36`,accent:`brown`,style:`tunic`,shirt:`cream`},cape:{color:`#3f7a3c`,style:`short`,lining:`#2b4a2c`},hat:`hood`,hatColor:`#3f7a3c`,weapon:`bow`,beard:!1,gear:{quiver:!0,boots:`brown`,gloves:`brown`},eyes:`green`},villager:{skin:`skinLight`,hair:`hairBrown`,hairStyle:`short`,outfit:{top:`cream`,bottom:`#5a6b82`,accent:`brown`,style:`tunic`,shirt:`cream`},cape:!1,hat:`none`,weapon:`none`,beard:!1,gear:{boots:`brown`},eyes:`brown`},farmer:{skin:`skinTan`,hair:`hairBrown`,hairStyle:`short`,outfit:{top:`#c9b48a`,bottom:`#3f5f88`,accent:`gold`,style:`overalls`,shirt:`#c9b48a`},cape:!1,hat:`wide`,hatColor:`thatch`,hatBand:`red`,weapon:`none`,beard:!1,gear:{boots:`brown`},eyes:`brown`},elder:{skin:`skinLight`,hair:`hairWhite`,hairStyle:`bald`,outfit:{top:`#7a6a5a`,bottom:`#5c4d3f`,accent:`brown`,style:`robe`,shirt:`cream`},cape:!1,hat:`none`,weapon:`cane`,beard:`full`,gear:{boots:`brown`,sash:`red`},build:`elder`,eyes:`brown`},child:{skin:`skinLight`,hair:`hairBlonde`,hairStyle:`ponytail`,outfit:{top:`#d9776a`,bottom:`#5a6b82`,accent:`cream`,style:`tunic`,shirt:`cream`},cape:!1,hat:`none`,weapon:`none`,beard:!1,gear:{boots:`brown`},build:`child`,eyes:`blue`,blush:!0},guard:{skin:`skinLight`,hair:`hairBrown`,hairStyle:`short`,outfit:{top:`blue`,bottom:`#4a4450`,accent:`gold`,style:`tabard`,shirt:`metal`},cape:!1,hat:`helmet`,weapon:`spear`,beard:!1,gear:{pauldrons:!0,boots:`black`,gloves:`brown`},eyes:`brown`},innkeeper:{skin:`skinLight`,hair:`hairBrown`,hairStyle:`bun`,outfit:{top:`#a8563f`,bottom:`#6e3a3a`,accent:`white`,style:`dress`,shirt:`cream`},cape:!1,hat:`none`,weapon:`none`,beard:!1,gear:{apron:`cream`,boots:`brown`},eyes:`brown`,blush:!0,female:!0},bard:{skin:`skinLight`,hair:`hairBlonde`,hairStyle:`short`,outfit:{top:`#3d5fb4`,bottom:`#5a3a24`,accent:`gold`,style:`tunic`,shirt:`cream`},cape:{color:`#8c2330`,style:`short`,lining:`#5a1420`},hat:`cap`,hatColor:`red`,hatBand:`gold`,feather:`white`,weapon:`lute`,beard:!1,gear:{boots:`brown`},eyes:`blue`}},rn={brown:`#5a3a2a`,blue:`#3a5ab0`,green:`#3a7a4a`,grey:`#5a6070`,violet:`#6a3a8a`,gold:`#a8781d`},an=[`cream`,`brown`,`green`,`blue`,`red`,`purple`,`#5a6b82`,`#8a6a4a`,`#6e3a3a`,`#3f5f5a`,`#a8563f`,`#c9b48a`,`#4a4450`],on=[`hairBrown`,`hairBrown`,`hairBlonde`,`hairBlack`,`hairRed`,`hairWhite`];function sn(e,t){let n=new u(t),r={preset:`villager`,...e},i=e.female??n.chance(.5);r.female=i,r.skin??=n.pick([`skinLight`,`skinLight`,`skinTan`,`skinDark`]),r.hair??=n.pick(on),r.hairStyle??=i?n.pick([`long`,`ponytail`,`bun`,`short`]):n.pick([`short`,`short`,`spiky`,`bald`]);let a=n.pick(an),o=n.pick(an);return o===a&&(o=`brown`),r.outfit={top:a,bottom:o,accent:n.pick([`brown`,`gold`,`cream`,`red`]),style:i?n.pick([`dress`,`dress`,`tunic`]):n.pick([`tunic`,`tunic`,`vest`,`overalls`]),shirt:`cream`,...e.outfit||{}},r.hat??=n.pick([`none`,`none`,`none`,`cap`,`wide`]),r.hat===`cap`&&(r.hatColor??=n.pick(an)),r.hat===`wide`&&(r.hatColor??=n.pick([`thatch`,`#7a5a3c`])),r.beard??=!i&&r.hairStyle!==`long`&&n.chance(.3)?n.pick([`full`,`mustache`,`goatee`]):!1,r.blush??=i&&n.chance(.6),r.eyes??=n.pick(Object.keys(rn)),r.gear={boots:n.pick([`brown`,`black`,`#5a3a24`]),apron:r.outfit.style===`dress`&&n.chance(.5)?`cream`:void 0,...e.gear||{}},r.gear.apron||delete r.gear.apron,r.cape??=!1,r.weapon??=`none`,r}function cn(e){if(!e||typeof e!=`object`)return{};let t={};for(let[n,r]of Object.entries(e))r!==void 0&&(t[n]=(n===`outfit`||n===`gear`)&&r&&typeof r==`object`?cn(r):r);return t}function ln(e){if(typeof e==`string`)return ne(e);let t=Number(e);return Number.isFinite(t)?t>>>0:1}function un(e={}){if(typeof e==`string`&&(e={preset:e}),e=cn(e),e.seed!==void 0&&(e.seed=ln(e.seed)),e.randomize||e.preset===`random`){let t=e.seed??1,{randomize:n,...r}=e;e=sn({...r,preset:e.preset===`random`?`villager`:e.preset??`villager`},t),e.seed=t,e._random=!0}let t=typeof e.preset==`string`&&Object.hasOwn(nn,e.preset),n=t?e.preset:String(e.preset??`villager`),r=e._random?{...nn.villager,gear:{}}:t?nn[n]:nn.villager,i={...r,...e,outfit:{...r.outfit,...e.outfit||{}},gear:{...r.gear,...e.gear||{}}};i.preset=n,i.seed=e.seed??ne(String(n)),e.seed!==void 0&&!e._random&&(i.jitter={top:!(e.outfit&&e.outfit.top),bottom:!(e.outfit&&e.outfit.bottom),hair:e.hair===void 0,eyes:e.eyes===void 0});let a=e.cape===void 0?r.cape:e.cape;a=a===!0?{color:r.cape?.color??`brown`,style:r.cape?.style??`cape`}:typeof a==`string`&&a!==`none`||typeof a==`number`||a&&a.isColor?{color:a,style:r.cape&&r.cape.style||`cape`}:!a||a===`none`?null:{...r.cape||{},...a},i.cape=a,i.hat=typeof i.hat==`string`&&Object.hasOwn(tn,i.hat)?i.hat:`none`,i.weapon=i.weapon||`none`;let o=i.beard;return o===!0&&(o=`full`),o===`none`&&(o=null),(typeof o==`string`&&!Object.hasOwn(en,o)||typeof o==`number`||o&&o.isColor)&&(i.beardColor=i.beardColor??o,o=`full`),i.beard=o||null,i.hairStyle=typeof i.hairStyle==`string`&&Object.hasOwn($t,i.hairStyle)?i.hairStyle:`short`,i.build=i.build||`normal`,i.rig=dn(i.build),i}function dn(e){if(e===`child`)return{cx:16,ground:30,headY:11,torsoTop:22,waist:25,hem:27,hip:26,robeHem:29,armTop:23,armLen:2,half:3,legW:2,legGap:1,bootH:1,child:!0};let t={cx:16,ground:30,headY:4,torsoTop:15,waist:21,hem:24,hip:24,robeHem:28,armTop:16,armLen:5,half:4,legW:3,legGap:2,bootH:2,child:!1};return e===`stout`&&(t.half=5),e===`elder`&&(t.headY=5,t.torsoTop=16,t.armTop=17,t.armLen=4),t}function fn(e){let t=Array(Gt).fill(null),n=new u(e.seed),r=(e,n,r)=>{t[e]=Wt(n,r)},i=(e,t)=>e===!0||e===!1||e==null||e===``?t:e;if(r(B.SKIN,e.skin||`skinLight`,`skin`),r(B.HAIR,e.hair||`hairBrown`,`hair`),r(B.BEARD,e.beardColor||e.hair||`hairBrown`,`hair`),r(B.TOP,e.outfit.top||`cream`),r(B.BOTTOM,e.outfit.bottom||`brown`),r(B.ACCENT,e.outfit.accent||`gold`),r(B.SHIRT,e.outfit.shirt||`cream`),r(B.CAPE,i(e.cape?.color,`brown`)),t[B.CAPEIN]=e.cape?.lining?Wt(e.cape.lining):t[B.CAPE].map(e=>M(e,-.25)),r(B.HAT,e.hatColor||(e.hat===`hood`?e.cape?.color||`green`:`brown`)),r(B.HATBAND,e.hatBand||e.outfit.accent||`red`),r(B.BOOT,i(e.gear.boots,`brown`)),r(B.METAL,`metal`),r(B.WOOD,`wood`),r(B.GOLD,`gold`),r(B.LEATHER,i(e.gear.leather,`brown`)),r(B.WHITE,i(e.gear.apron,e.gear.apron===!0?`cream`:`white`)),r(B.SCARF,i(e.gear.scarf,`red`)),r(B.PACK,i(e.gear.packColor,`#b09a70`)),r(B.GEM,i(e.gear.staffGem,`blue`)),r(B.STRING,`cream`),r(B.FEATHER,i(e.feather,`white`)),r(B.BOOK,i(e.gear.bookColor,`red`)),r(B.BELT,i(e.gear.belt,`brown`)),r(B.SASH,i(e.gear.sash,i(e.outfit.accent,`gold`))),r(B.BONE,i(e.gear.beads,`#d8ccae`)),r(B.GEL,`#4fbf5f`),e.gear.gemGlow&&(t[B.GEM]=t[B.GEM].map(Ut)),t[B.LINE]=[z,z,z,z,z],e.jitter){let n=new u(e.seed^1540483477),r=(e,t,n,r=1)=>e.map(e=>{let[i,a,o]=Me(e);return[...Ie([i+t,Math.min(1,a*r),Math.max(0,Math.min(1,o+n))]),e[3]??255]});e.jitter.top&&(t[B.TOP]=r(t[B.TOP],n.range(-14,14),n.range(-.05,.05),n.range(.85,1.1))),e.jitter.bottom&&(t[B.BOTTOM]=r(t[B.BOTTOM],n.range(-12,12),n.range(-.05,.04))),e.jitter.hair&&(t[B.HAIR]=r(t[B.HAIR],n.range(-6,6),n.range(-.04,.04))),e.jitter.eyes&&(e.eyes=n.pick(Object.keys(rn)))}let a=t[B.SKIN];t[B.BLUSH]=[0,1,2,3,4].map(()=>L(a[2],`#e0607a`,.35));let s=Bt(xe(rn,e.eyes)||e.eyes||n.pick(Object.values(rn)),rn.brown),c=L(z,s,.25);t[B.EYE]=[z,c,[...o(s)],M(s,.3),[255,255,255,255]];for(let e=0;e<Gt;e++)t[e]||(t[e]=t[B.TOP]);return t}var pn=[{key:`idle0`,bob:0,br:0,walk:-1},{key:`idle1`,bob:0,br:1,walk:-1},{key:`walk0`,bob:0,br:0,walk:0},{key:`walk1`,bob:-1,br:0,walk:1},{key:`walk2`,bob:0,br:0,walk:2},{key:`walk3`,bob:-1,br:0,walk:3}];function W(e){if(e.lag)return e.lag;if(e.walk<0)return{dy:e.br?-1:0,sway:0,trail:0};let t=(e.walk+3)%4;return{dy:(t===1||t===3?-1:0)-e.bob,sway:[1,0,-1,0][t],trail:e.walk===1||e.walk===3?2:1}}function G(e,t){return t<=1?2:e===0?3:e===t-1?1:2}function mn(e,t,n,r){let i=t.rig,a=n.act?dr(n,r):null,o=a?a.lifts:[[0,0],[0,0],[0,1],[0,2],[1,0],[2,0]][n.walk+2]||[0,0],s=i.hip+n.bob,c=i.child?[i.cx-3,i.cx+1]:[i.cx-4,i.cx+1];a&&(c[0]-=a.spread,c[1]+=a.spread);let l=t.outfit.style===`robe`||t.outfit.style===`dress`;for(let t=0;t<2;t++){let n=o[t],a=c[t],u=i.ground-n;e.begin(t===1?`sides`:null,1);for(let t=s;t<=u;t++){let n=t>u-i.bootH;for(let o=0;o<i.legW;o++){let c=G(o,i.legW);t<=s+1&&(c=Math.min(c,1)),n?(c=t===u?1:G(o,i.legW),r&&t===u&&(c=0),e.set(a+o,t,B.BOOT,c)):e.set(a+o,t,B.BOTTOM,l?Math.max(0,c-1):c)}}!r&&n===0&&!i.child&&e.set(t===0?a-1:a+i.legW,u,B.BOOT,t===0?2:1),e.end()}}function hn(e){switch(e.walk){case 0:return[-1,1];case 2:return[1,-1];default:return[0,0]}}function gn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.torsoTop+a,s=i.waist+a,c=i.hem+n.bob,l=i.cx,u=i.half,d=t.outfit.style,f=W(n),p=l-u,m=l+u-1;e.begin(null);for(let t=o;t<s;t++){let n=+(t===o);for(let r=p+n;r<=m-n;r++){let n=G(r-p,m-p+1);t===o&&(n=Math.min(n,1)),e.set(r,t,B.TOP,n)}}if(d===`robe`||d===`dress`||d===`dancer`){let t=d===`dancer`?i.ground-1:i.robeHem+0,r=d===`robe`?B.TOP:B.BOTTOM;for(let a=s;a<=t+n.bob;a++){let o=(a-s)/Math.max(1,t+n.bob-s),c=Math.round(o*(i.child?1:2)),u=a>=t+n.bob-1?f.sway:0,h=p-c+(a===t+n.bob?Math.max(0,u):0),g=m+c+(a===t+n.bob?Math.min(0,u):0);for(let i=h;i<=g;i++){let o=G(i-h,g-h+1),c=i-l;a>s+1&&(c===-2||c===2)&&(o=Math.max(1,o-1)),a>s+2&&c===0&&d!==`dancer`&&(o=Math.min(3,o+0)),a===t+n.bob&&(o=Math.max(0,o-1)),e.set(i,a,r,o)}}}else for(let t=s;t<=c;t++){let n=+(t>s),r=p-(t===c?n:0)-0,i=m+(t===c?n:0),a=d===`overalls`?B.BOTTOM:B.TOP;for(let n=r;n<=i;n++){let o=G(n-r,i-r+1);t===c&&(o=Math.max(1,o-1)),t>s&&(n===l-2||n===l+1)&&d===`tunic`&&(o=Math.max(1,o-1)),e.set(n,t,a,o)}}if(e.end(),!r&&(d===`tunic`||d===`dress`||d===`tabard`||d===`overalls`)&&(e.over(p+1,o+1,B.TOP,3),e.over(p+1,o+2,B.TOP,3),e.over(p+2,o+1,B.TOP,3)),r){if((d===`tunic`||d===`vest`)&&(e.set(p+1,o+1,B.TOP,3),e.set(p+2,o+1,B.TOP,3),e.set(m-1,o+2,B.TOP,1)),d===`overalls`){e.set(l-2,o,B.BOTTOM,2),e.set(l+1,o,B.BOTTOM,1);for(let t=o+1;t<s;t++)e.set(l-1-Math.floor((s-t)/3),t,B.BOTTOM,2),e.set(l+Math.floor((s-t)/3),t,B.BOTTOM,1)}if(d===`tabard`){for(let t=o;t<=c+1;t++)for(let n=l-2;n<=l+1;n++)e.set(n,t,B.TOP,n===l-2?3:n===l+1?1:2);for(let t=o+1;t<s;t++)e.set(p,t,B.METAL,t&1?3:2),e.set(m,t,B.METAL,t&1?1:2)}if(d===`dancer`){for(let t=p;t<=m;t++)e.set(t,s-1,B.SKIN,t===p?3:t===m?1:2);for(let t=p;t<=m;t++)e.set(t,s-2,B.GOLD,t===m?2:3)}}else if(d===`robe`){e.set(l-1,o,B.SHIRT,2),e.set(l,o,B.SHIRT,1);for(let t=o+1;t<=i.robeHem+n.bob;t++)e.set(l-0,t,B.ACCENT,t<s?3:2);for(let t=o+1;t<=i.robeHem+n.bob;t++)e.set(l-1,t,B.ACCENT,3);e.set(l-1,o+1,B.ACCENT,4)}else if(d===`tunic`)e.set(l-1,o,B.TOP,0),e.set(l,o,B.TOP,0),e.set(l-1,o+1,B.TOP,1),e.set(l-2,o,B.TOP,2),e.set(l+1,o,B.TOP,1);else if(d===`vest`){for(let t=o;t<s;t++)e.set(l-1,t,B.SHIRT,t===o?1:3),e.set(l,t,B.SHIRT,t===o?1:2);e.set(l-2,o+1,B.GOLD,3),e.set(l+1,o+1,B.GOLD,2),e.set(l-2,o+3,B.GOLD,3),e.set(l+1,o+3,B.GOLD,2)}else if(d===`overalls`){for(let t=o+2;t<s;t++)for(let n=l-2;n<=l+1;n++)e.set(n,t,B.BOTTOM,n===l-2?3:n===l+1?1:2);e.set(l-3,o,B.BOTTOM,2),e.set(l-3,o+1,B.BOTTOM,2),e.set(l+2,o,B.BOTTOM,1),e.set(l+2,o+1,B.BOTTOM,1),e.set(l-2,o+2,B.GOLD,3),e.set(l+1,o+2,B.GOLD,2),e.set(l-1,o+3,B.BOTTOM,1),e.set(l,o+3,B.BOTTOM,1)}else if(d===`tabard`){for(let t=o;t<=c+1;t++)for(let n=l-2;n<=l+1;n++){let r=n===l-2?3:n===l+1?1:2;e.set(n,t,B.TOP,t===c+1?Math.max(0,r-1):r)}e.set(l-1,o+2,B.GOLD,4),e.set(l,o+2,B.GOLD,3),e.set(l-1,o+3,B.GOLD,3),e.set(l,o+3,B.GOLD,2);for(let t=o+1;t<s;t++)e.set(p,t,B.METAL,t&1?3:2),e.set(m,t,B.METAL,t&1?1:2)}else if(d===`dress`)e.set(l-1,o,B.TOP,0),e.set(l,o,B.TOP,0),e.set(l-2,o,B.SHIRT,3),e.set(l+1,o,B.SHIRT,2);else if(d===`dancer`){e.set(l-1,o,B.SKIN,2),e.set(l,o,B.SKIN,1);for(let t=p;t<=m;t++)e.set(t,s-1,B.SKIN,t===p?3:t===m?1:2);for(let t=p;t<=m;t++)e.set(t,s-2,B.GOLD,t===m?2:3);e.set(l-1,s-1,B.SKIN,1)}if(d===`tunic`||d===`vest`||d===`tabard`){for(let t=p;t<=m;t++)e.set(t,s,B.BELT,t===p?3:t===m?1:2);r||(e.set(l-1,s,B.GOLD,4),e.set(l,s,B.GOLD,2))}else if(d===`robe`){for(let t=p;t<=m;t++)e.set(t,s,B.SASH,t===p?3:t===m?1:2);r?(e.set(l-2,s+1,B.SASH,2),e.set(l-2,s+2,B.SASH,1)):(e.set(l+1,s+1,B.SASH,1),e.set(l+1,s+2,B.SASH,2),e.set(l+2,s+3,B.SASH,1))}else if(d===`dress`){for(let t=p;t<=m;t++)e.set(t,s,B.ACCENT,t===p?3:t===m?1:2);r&&(e.set(l-1,s+1,B.ACCENT,3),e.set(l,s+1,B.ACCENT,2),e.set(l-2,s+2,B.ACCENT,2),e.set(l+1,s+2,B.ACCENT,1))}else if(d===`dancer`)for(let t=p-1;t<=m+1;t++)e.set(t,s,B.GOLD,t<=p?4:t>=m?2:3);if(t.gear.apron&&!r){for(let t=s+1;t<=(d===`dress`?i.robeHem-1:c)+n.bob;t++){let n=2+ +(t>s+2);for(let r=l-n;r<=l+n-1;r++)e.set(r,t,B.WHITE,r===l-n?3:r===l+n-1?1:2)}for(let t=l-2;t<=l+1;t++)e.set(t,o+1,B.WHITE,3);for(let t=o+2;t<s;t++)for(let n=l-2;n<=l+1;n++)e.set(n,t,B.WHITE,n===l+1?1:2);e.set(l-1,s+3,B.WHITE,1)}}function _n(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=hn(n),s=i.half,c=t.outfit.style,l=c===`vest`||c===`overalls`?B.SHIRT:c===`tabard`?B.METAL:c===`dancer`?B.SKIN:B.TOP,u=c===`robe`;for(let n=0;n<2;n++){let d=r?-o[n]:o[n],f=n===0?i.cx-s-2:i.cx+s,p=i.armTop+a,m=i.armLen+(d>0?0:d);e.begin(`sides`,1);for(let t=p;t<p+m;t++){for(let r=0;r<2;r++){let i=r===0?2:1;t===p&&(i=n===0?3:2),l===B.SKIN&&(i=n===0?r===0?3:2:r===0?2:1),e.set(f+r,t,l,i)}u&&t>=p+m-2&&e.set(n===0?f-1:f+2,t,B.TOP,n===0?2:1)}u&&(e.set(f,p+m-1,B.ACCENT,3),e.set(f+1,p+m-1,B.ACCENT,2),e.set(n===0?f-1:f+2,p+m-1,B.ACCENT,2)),t.gear.bracers&&!i.child&&(e.set(f,p+m-1,B.METAL,3),e.set(f+1,p+m-1,B.METAL,2)),c===`dancer`&&(e.set(f,p+m-1,B.GOLD,3),e.set(f+1,p+m-1,B.GOLD,2));let h=p+m,g=t.gear.gloves?B.LEATHER:B.SKIN;if(e.set(f,h,g,n===0?3:2),e.set(f+1,h,g,n===0?2:1),i.child||(e.set(f,h+1,g,1),e.set(f+1,h+1,g,1)),e.end(),t.gear.pauldrons&&!i.child){e.begin(`below`,1);let t={1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3],5:[B.METAL,4]},r=n===0?[`.45.`,`4543`,`2332`]:[`.43.`,`3432`,`1221`];e.tpl(U(r,t),f-1,p-1),e.end()}}}function vn(e,t,n,r,i){let a=r+6,o=n+3,s=n+8;if(i&&ar.has(i.act)){kr(e,t,n,r);return}if(t.face===`fierce`){rr(e,t,n,r);return}if(e.set(o,a,B.EYE,0),e.set(o,a+1,B.EYE,2),e.set(s,a,B.EYE,0),e.set(s,a+1,B.EYE,2),t.female&&(e.set(o-1,a,B.EYE,1),e.set(s+1,a,B.EYE,1)),(!t.beard||t.beard===`goatee`)&&e.set(n+6,r+9,B.SKIN,1),t.blush&&(e.set(n+2,r+8,B.BLUSH,2),e.set(n+9,r+8,B.BLUSH,2)),t.gear.glasses){for(let t of[o,s])e.set(t-1,a,B.GOLD,3),e.set(t+1,a,B.GOLD,2),e.set(t-1,a+1,B.GOLD,2),e.set(t+1,a+1,B.GOLD,1),e.set(t,a-1,B.GOLD,4),e.set(t,a+2,B.GOLD,1),e.set(t,a,B.WHITE,3);for(let t=o+2;t<=s-2;t++)e.set(t,a,B.GOLD,2)}}function yn(e,t,n,r,i){let a=r+6;if(i&&ar.has(i.act)){Ar(e,t,n,r);return}if(t.face===`fierce`){ir(e,t,n,r);return}if(e.set(n+2,a,B.EYE,0),e.set(n+2,a+1,B.EYE,2),t.female&&e.set(n+3,a,B.EYE,1),t.beard||e.set(n+1,r+9,B.SKIN,1),e.set(n+6,a,B.SKIN,1),e.set(n+6,a+1,B.SKIN,1),e.set(n+7,a,B.SKIN,2),e.set(n+7,a+1,B.SKIN,0),t.blush&&e.set(n+3,r+8,B.BLUSH,2),t.gear.glasses){e.set(n+1,a,B.GOLD,4),e.set(n+3,a,B.GOLD,3),e.set(n+2,a-1,B.GOLD,4),e.set(n+2,a+2,B.GOLD,2),e.set(n+1,a+1,B.GOLD,3),e.set(n+3,a+1,B.GOLD,2);for(let t=n+4;t<=n+6;t++)e.set(t,a-1,B.GOLD,2)}}function bn(e,t,n,r,i,a,o=0){if(!i||!a&&!o){e.tpl(t,n,r);return}let s=t.oy||0;e.tpl({...t,rows:t.rows.slice(0,i)},n,r);for(let a=0;a<o;a++)e.tpl({...t,rows:[t.rows[i]],oy:s+i+a},n,r);e.tpl({...t,rows:t.rows.slice(i),oy:s+i+o},n+a,r)}var xn={1:[B.CAPE,0],2:[B.CAPE,1],3:[B.CAPE,2],4:[B.CAPE,3],5:[B.CAPE,4],i:[B.CAPEIN,1],I:[B.CAPEIN,2],j:[B.CAPEIN,3],g:[B.GOLD,2],G:[B.GOLD,4]},Sn=U([`..3444433322..`,`.344443333322.`,`.34444Gg33322.`,`344444Ii333221`,`34444I..i33221`,`34443I..i32221`,`34443I..i32221`,`.3333i..i2221.`],xn,-7,-2),Cn=U([`.34444Gg33322.`,`343........221`,`.3..........1.`],xn,-7,0),wn=U([`.....34443....`,`...G44443332..`,`..34444433322.`,`.344444333222.`,`.34443333222..`,`..33332222I...`,`...2...2......`],xn,-5,-1),Tn=U([`.2IjjjjI2.`,`3444444332`,`3444433322`,`.34443322.`,`..343322..`,`...3322...`,`....32....`],xn,-5,-1);function En(e,t,n){let r=t.rig,i=t.cape.style===`short`,a=n.bob+n.br,o=W(n),s=r.torsoTop+a+2,c=(i?r.waist+a+1:r.robeHem)+o.dy;e.begin(null);for(let t=s;t<=c;t++){let n=(t-s)/Math.max(1,c-s),a=r.half+2+ +(n>.7&&!i),l=t>=c-1?o.sway:0,u=r.cx-a+l,d=r.cx+a-1+l;for(let n=u;n<=d;n++)n===u?e.set(n,t,B.CAPE,t===c?1:2):n===d?e.set(n,t,B.CAPE,t===c?0:1):e.set(n,t,B.CAPEIN,t===c?1:2)}e.end()}function Dn(e,t,n){let r=t.rig,i=n.bob+n.br,a=r.torsoTop+i;e.begin(`below`,1),e.tpl(t.cape.style===`cloak`?Sn:Cn,r.cx,a),e.end()}function On(e,t,n){let r=t.rig,i=n.bob+n.br,a=W(n),o=r.torsoTop+i,s=t.cape.style===`cloak`,c=(t.cape.style===`short`?o+7:r.robeHem)+a.dy;e.begin(null);for(let t=o;t<=c;t++){let n=(t-o)/Math.max(1,c-o),i=(t===o?r.half+1:r.half+2)+ +(n>.6),s=t>=c-2?a.sway:0,l=r.cx-i+s,u=r.cx+i-1+s;for(let n=l;n<=u;n++){let i=G(n-l,u-l+1),a=n-r.cx-s;t>o+3&&(a===-3||a===2?i=1:(a===-2||a===3)&&(i=Math.min(3,i+1))),t===c&&(i=Math.max(0,i-1)),(t!==c||a!==-3&&a!==2)&&e.set(n,t,B.CAPE,i)}}if(e.end(),s)e.begin(`all`,1),e.tpl(Tn,r.cx,o),e.end();else{e.begin(null);for(let t=r.cx-r.half-1;t<=r.cx+r.half;t++)e.set(t,o,B.CAPE,t<r.cx-2?4:t>r.cx+2?2:3);e.end()}}function kn(e,t,n,r,i){i===`spear`?(e.set(n,r-3,B.METAL,4),e.set(n-1,r-2,B.METAL,3),e.set(n,r-2,B.METAL,4),e.set(n+1,r-2,B.METAL,2),e.set(n-1,r-1,B.METAL,2),e.set(n,r-1,B.METAL,3),e.set(n+1,r-1,B.METAL,1),e.set(n,r,B.METAL,2),e.set(n-1,r+1,B.SCARF,3),e.set(n,r+1,B.GOLD,3),e.set(n+1,r+1,B.SCARF,1)):i===`staff`?(e.set(n-1,r-1,B.GOLD,3),e.set(n,r-2,B.GOLD,4),e.set(n+1,r-1,B.GOLD,2),e.set(n-1,r,B.GOLD,3),e.set(n+1,r,B.GOLD,1),e.set(n,r-1,B.GEM,4),e.set(n,r,B.GEM,2),e.set(n,r+1,B.GOLD,2)):i===`cane`&&(e.set(n,r,B.WOOD,3),e.set(n+1,r-1,B.WOOD,3),e.set(n+2,r-1,B.WOOD,2),e.set(n+3,r,B.WOOD,1))}function An(e,t){return e===`spear`||e===`staff`?t-16:t-3}var jn=.125;function Mn(e,t,n,r,i){let a=t.rig,o=An(i,r),s=a.ground;e.begin(null);for(let t=o;t<=s;t++)e.set(n,t,B.WOOD,t<r?3:2);kn(e,t,n,o,i),e.end()}function Nn(e,t,n,r,i){e.begin(`sides`,0),n.act?e.set(r,i-1,B.GOLD,2):(e.set(r,i-2,B.GOLD,4),e.set(r-1,i-1,B.GOLD,3),e.set(r,i-1,B.LEATHER,2),e.set(r+1,i-1,B.GOLD,2));for(let t=0;t<6;t++)e.set(r+ +(t>3),i+t,B.LEATHER,t===5?1:2);e.set(r+1,i+5,B.METAL,3),e.end()}function Pn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.torsoTop+a,s=r===`down`;if(t.gear.pack&&s){e.begin(null);let t=i.half+4,n=o-5;for(let r=n+2;r<=o+8;r++)e.set(i.cx-t,r,B.PACK,3),e.set(i.cx-t+1,r,B.PACK,2),e.set(i.cx+t-2,r,B.PACK,1),e.set(i.cx+t-1,r,B.PACK,1);for(let n=i.cx-t;n<=i.cx+t-1;n++)e.set(n,o+8,B.PACK,0);for(let r=i.cx-t-1;r<=i.cx+t;r++){let a=r===i.cx-t-1||r===i.cx+t;e.set(r,n,B.CAPE,a?2:3),e.set(r,n+1,B.CAPE,a?1:r<i.cx?3:2),e.set(r,n+2,B.CAPE,+!a)}e.set(i.cx-t-1,n+1,B.CAPEIN,2),e.set(i.cx+t,n+1,B.CAPEIN,1),e.set(i.cx-t+2,n,B.LEATHER,2),e.set(i.cx-t+2,n+1,B.LEATHER,1),e.set(i.cx-t+2,n+2,B.LEATHER,0),e.set(i.cx+t-3,n,B.LEATHER,2),e.set(i.cx+t-3,n+1,B.LEATHER,1),e.set(i.cx+t-3,n+2,B.LEATHER,0),e.end()}if(t.gear.pack&&!s){e.begin(s?null:`all`,0);let t=i.half+3,n=o-4;for(let r=n;r<=o+9;r++)for(let n=i.cx-t;n<=i.cx+t-1;n++){let a=G(n-(i.cx-t),2*t);r===o+9&&(a=1),e.set(n,r,B.PACK,a)}for(let r=i.cx-t-1;r<=i.cx+t;r++)e.set(r,n-1,B.CAPE,3),e.set(r,n-2,B.CAPE,r<i.cx?3:2),e.set(r,n,B.CAPE,1);if(e.set(i.cx-t-1,n-2,B.CAPE,1),e.set(i.cx+t,n-1,B.CAPE,0),!s){for(let r=i.cx-t+1;r<=i.cx+t-2;r++)e.set(r,n+4,B.LEATHER,2);for(let r=n+1;r<=n+4;r++)e.set(i.cx-t+1,r,B.PACK,1),e.set(i.cx+t-2,r,B.PACK,1);e.set(i.cx-1,n+4,B.GOLD,4),e.set(i.cx,n+4,B.GOLD,2);for(let t=n+6;t<=o+7;t++)e.set(i.cx-3,t,B.LEATHER,2),e.set(i.cx+2,t,B.LEATHER,1);e.set(i.cx+t,o+3,B.METAL,2),e.set(i.cx+t,o+4,B.METAL,1),e.set(i.cx+t+1,o+3,B.METAL,1),e.set(i.cx+t+1,o+4,B.METAL,0)}e.end()}if(t.gear.quiver){e.begin(s?null:`all`,1);let t=s?i.cx+i.half:i.cx+2;for(let n=0;n<9;n++){let r=t-Math.floor(n/3)+0,i=o-3+n;e.set(r,i,B.LEATHER,2),e.set(r+1,i,B.LEATHER,1)}e.set(t,o-4,B.WHITE,3),e.set(t+1,o-5,B.WHITE,4),e.set(t+2,o-4,B.SCARF,3),e.set(t+1,o-4,B.SCARF,2),e.end()}if(t.weapon===`bow`&&!n.act){e.begin(s?null:`all`,1);let t=s?i.cx-i.half-2:i.cx-i.half,n=[];for(let e=0;e<=14;e++){let r=e/14,a=t+Math.round(r*(i.half*2+2)+Math.sin(r*Math.PI)*-2),s=o-3+Math.round(r*12);n.push([a,s])}for(let[t,r]of n)e.set(t,r,B.WOOD,3);if(!s)for(let n=0;n<=12;n++)e.set(t+1+Math.round(n/12*(i.half*2)),o-2+n,B.STRING,3);e.end()}if(t.weapon===`lute`){if(e.begin(s?null:`all`,1),s){let t=i.cx+i.half+1;for(let n=0;n<5;n++)e.set(t-Math.floor(n/3),o-4+n,B.WOOD,2);e.set(t,o-5,B.WOOD,1),e.set(t+1,o-5,B.WOOD,1)}else{let t=i.cx-2,n=o+3;e.tpl(U([`.3332.`,`344332`,`343332`,`343322`,`.3322.`,`..22..`],{2:[B.WOOD,1],3:[B.WOOD,2],4:[B.WOOD,3]}),t-1,n);for(let r=1;r<=6;r++)e.set(t+3+Math.floor(r/2),n-r,B.WOOD,2);e.set(t+6,n-7,B.WOOD,1),e.set(t+7,n-7,B.WOOD,1);for(let t=0;t<7;t++)e.set(i.cx-i.half+t,o+t,B.LEATHER,2)}e.end()}}function Fn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.torsoTop+a;e.begin(null);let s=i.waist-i.torsoTop,c=!r&&t.cape&&t.cape.style===`cloak`;for(let t=0;t<=s&&!c;t++){let n=r?i.cx+i.half-1-Math.round(t*(i.half*2-1)/s):i.cx-i.half+Math.round(t*(i.half*2-1)/s);e.set(n,o+t,B.LEATHER,1)}e.end(),e.begin(`all`,0);let l=r?i.cx-i.half-1:i.cx+i.half-1,u=i.waist+a+1,d=r?[`.4443`,`43332`,`33322`,`.222.`]:[`4443.`,`34g32`,`33322`,`.222.`];e.tpl(U(d,{2:[B.LEATHER,1],3:[B.LEATHER,2],4:[B.LEATHER,3],g:[B.GOLD,4]}),l-1,u),e.end()}function In(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.torsoTop+a,s=W(n);e.begin(`below`,0);for(let t=i.cx-i.half;t<=i.cx+i.half-1;t++){let n=t-(i.cx-i.half);e.set(t,o,B.SCARF,n<2?3:n>2*i.half-3?1:2),e.set(t,o-1,B.SCARF,n<2?4:n>2*i.half-3?2:3)}if(r){e.set(i.cx-2,o+1,B.SCARF,3),e.set(i.cx-1,o+1,B.SCARF,3),e.set(i.cx,o+1,B.SCARF,2);let t=6+s.dy;for(let n=2;n<=t;n++){let r=n>=t-1?s.sway:0,a=i.cx-2+r;e.set(a,o+n,B.SCARF,3),e.set(a+1,o+n,B.SCARF,n===t?1:2),n<=t-2&&e.set(a+2,o+n,B.SCARF,1)}}else{let t=i.cx+1;e.set(t,o+1,B.SCARF,2),e.set(t+1,o+1,B.SCARF,1);for(let n=2;n<=5;n++)e.set(t+1+(n>3?+(s.sway>0):0),o+n,B.SCARF,n===5?1:2)}e.end()}function Ln(e,t,n,r){let i=t.rig,a=n.bob,o=W(n),s=i.waist+a;e.begin(null);for(let t=0;t<2;t++){let n=t===0?-1:1,r=n<0?i.cx-i.half-1:i.cx+i.half;for(let i=0;i<7+o.dy;i++){let a=Math.floor(i/3)*n+(i>3?o.sway:0);e.set(r+a,s+i,B.GOLD,t===0?3:2)}}e.end()}function Rn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.cx-6,s=i.headY+a,c=r?`up`:`down`,l=W(n);e.begin(null),e.tpl(Qt[c],o,s),e.end(),r||(e.begin(null),vn(e,t,o,s,n),e.end());let u=t.hat,d=$t[t.hairStyle][c];u===`hood`?r||(e.begin(`below`,1),e.tpl(U([`.33432332.`,`..3.3..2..`],V),o+1,s+3),e.end()):(e.begin(r?null:`below`,1),bn(e,d.front,o,s,d.swayFrom,l.sway,Math.max(0,l.dy)),e.end(),t.hairStyle===`ponytail`&&Bn(e,t,o,s,l,r)),t.beard&&!r&&(e.begin(null),e.tpl(en[t.beard].down,o,s),e.end()),t.ears===`pointed`&&u!==`hood`&&u!==`helmet`&&Qn(e,o,s,r),u!==`none`&&tn[u]&&(e.begin(u===`wide`||u===`cap`?`below`:u===`circlet`?null:`below`,1),e.tpl(tn[u][c],o,s,zn(t,tn[u][c])),e.end()),u===`hood`&&t.feather&&er(e,o,s,c)}function zn(e,t){return e.feather?null:{...t.legend,f:null,F:null,e:null}}function Bn(e,t,n,r,i,a){if(a){e.begin(`all`,0);let t=n+5,a=12+i.dy;for(let n=3;n<=a;n++){let o=t+(n>8?i.sway:0),s=n>a-2?1:2,c=n%3!=0;e.set(o,r+n,B.HAIR,c?3:2),s>1&&e.set(o+1,r+n,B.HAIR,c?2:1),n>4&&n<a-2&&e.set(o-1,r+n,B.HAIR,2)}e.end(),e.begin(null),e.set(t-1,r+3,B.ACCENT,3),e.set(t,r+3,B.ACCENT,4),e.set(t+1,r+3,B.ACCENT,2),e.end();return}e.begin(null);{let t=n+11;for(let n=0;n<7+i.dy;n++){let a=t+ +(n>2)+(n>4?i.sway:0);e.set(a,r+1+n,B.HAIR,n<3?2:1),n>1&&n<6&&e.set(a+1,r+1+n,B.HAIR,1)}}e.end()}function Vn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=n.act?mr(t,n,r?`up`:`down`):null;o&&fr(e,o),r||(t.cape&&En(e,t,n),Pn(e,t,n,`down`),$t[t.hairStyle].down.back&&t.hat!==`hood`&&(e.begin(null),e.tpl($t[t.hairStyle].down.back,i.cx-6,i.headY+a),e.end()));let s=[`staff`,`spear`,`cane`].includes(t.weapon)?t.weapon:null,c=hn(n),l=e=>i.armTop+a+i.armLen+(r?-c[e]:c[e]);if(s&&r&&!o&&Mn(e,t,i.cx+i.half+2,l(1),s),o&&gr(e,t,o,`behind`),o&&pr(e),mn(e,t,n,r),o&&fr(e,o),gn(e,t,n,r),t.gear.beads&&tr(e,t,n,r),t.gear.sashes&&Ln(e,t,n,r),t.gear.satchel&&!t.cape&&Fn(e,t,n,r),t.gear.satchel&&t.cape&&!r&&Fn(e,t,n,r),t.weapon===`sword`&&!r&&Nn(e,t,n,i.cx+i.half+1,i.waist+a+1),t.weapon===`sword`&&r&&Nn(e,t,n,i.cx-i.half-2,i.waist+a+1),o?gr(e,t,o,`under`):_n(e,t,n,r),t.gear.book&&!r&&!o){e.begin(`all`,1);let t=i.cx-i.half-3,n=l(0)-2;e.tpl(U([`2332`,`3443`,`3443`,`2332`,`1221`],{1:[B.BOOK,0],2:[B.BOOK,1],3:[B.BOOK,2],4:[B.WHITE,3]}),t,n),e.set(t+2,n+2,B.SKIN,2),e.set(t+3,n+2,B.SKIN,1),e.end()}if(s&&!r&&!o&&Mn(e,t,i.cx-i.half-3,l(0),s),s&&!r&&!o&&(e.begin(null),e.set(i.cx-i.half-4,l(0),B.SKIN,3),e.set(i.cx-i.half-2,l(0),B.SKIN,2),e.set(i.cx-i.half-3,l(0)+1,B.SKIN,1),e.end()),t.gear.scarf&&!r&&In(e,t,n,!1),t.cape&&!r&&Dn(e,t,n),Rn(e,t,n,r),s===`staff`&&!o){let n=+!!r,a=r?i.cx+i.half+2:i.cx-i.half-3;e.begin(null),kn(e,t,a,An(`staff`,l(n)),`staff`),e.end()}r&&(t.cape&&On(e,t,n),Pn(e,t,n,`up`),t.gear.scarf&&In(e,t,n,!0)),o&&gr(e,t,o,`over`)}function Hn(e,t){let n=t?.67:1,r=(e,t,r=0,i=!1)=>({knee:Math.round(e*n),ankle:Math.round(t*n),lift:Math.round(r*n),tip:i});if(e.act)return ur(e,r);switch(e.walk){case 0:return[r(-2,-3),r(1,3,0,!0)];case 1:return[r(0,0),r(-2,-1,2)];case 2:return[r(1,3,0,!0),r(-2,-3)];case 3:return[r(-2,-1,2),r(0,0)];default:return[r(-1,-1),r(1,1)]}}function Un(e,t,n,r,i){let a=t.rig,o=a.hip+n.bob,s=a.ground-r.lift-(a.bootH-1),c=a.ground-r.lift,l=Math.round((o+s)/2),u=a.cx-(a.child?1:2)+ +!!i,d=a.child?2:3,f=i?-1:0;e.begin(i?null:`sides`,0);for(let t=o;t<s;t++){let n;n=Math.round(t<=l?r.knee*((t-o)/Math.max(1,l-o)):r.knee+(r.ankle-r.knee)*((t-l)/Math.max(1,s-l)));let i=t<=l?d:Math.max(2,d-1);for(let r=0;r<i;r++){let a=G(r,i)+f;t===o&&(a=Math.min(a,1+f)),e.set(u+n+r,t,B.BOTTOM,Math.max(0,a))}}let p=u+r.ankle;for(let t=s;t<=c;t++){let n=t===c,i=a.child?2:3;for(let a=0;a<i;a++){let o=n?a===0?2:1:G(a,i);e.set(p+a-(n&&!r.tip?1:0),t,B.BOOT,Math.max(0,o+f))}!n&&!a.child&&e.set(p,t,B.BOOT,Math.max(0,3+f))}r.tip&&e.set(p+(a.child?2:3),c-1,B.BOOT,Math.max(0,1+f)),e.end()}function Wn(e,t,n,r,i){let a=t.rig,o=n.bob+n.br,s=a.cx-1,c=a.armTop+o,l=a.armLen,u=t.outfit.style,d=u===`vest`||u===`overalls`?B.SHIRT:u===`tabard`?B.METAL:u===`dancer`?B.SKIN:B.TOP;e.begin(r?`all`:null,1);for(let t=0;t<l;t++){let n=t/Math.max(1,l-1),a=s+Math.round(i*n),o=r?3:1,f=r?2:0;d===B.SKIN&&(o=r?3:1,f=r?2:1),e.set(a,c+t,d,o),e.set(a+1,c+t,d,f),u===`robe`&&t>=l-2&&e.set(a+(i>0?2:-1),c+t,B.TOP,r?2:0)}let f=s+i,p=c+l;u===`robe`&&(e.set(f,p-1,B.ACCENT,r?3:1),e.set(f+1,p-1,B.ACCENT,r?2:1)),t.gear.bracers&&!a.child&&(e.set(f,p-1,B.METAL,r?3:1),e.set(f+1,p-1,B.METAL,r?2:1)),u===`dancer`&&(e.set(f,p-1,B.GOLD,r?3:1),e.set(f+1,p-1,B.GOLD,r?2:1));let m=t.gear.gloves?B.LEATHER:B.SKIN;return e.set(f,p,m,r?3:1),e.set(f+1,p,m,r?2:1),a.child||e.set(f+(i<0?0:1),p+1,m,+!!r),e.end(),[f,p]}function Gn(e,t,n){let r=t.rig,i=n.bob+n.br,a=r.torsoTop+i,o=r.waist+i,s=r.hem+n.bob,c=t.outfit.style,l=W(n),u=r.cx-(r.child?3:4)+1,d=r.cx+(r.child?2:3)-(r.half>=5?-1:0);e.begin(null);for(let t=a;t<o;t++){let n=+(t===a);for(let r=u+n;r<=d-n;r++){let n=G(r-u,d-u+1);t===a&&(n=Math.min(n,1)),e.set(r,t,B.TOP,n)}}if(c===`robe`||c===`dress`||c===`dancer`){let t=(c===`dancer`?r.ground-1:r.robeHem)+n.bob,i=c===`robe`?B.TOP:B.BOTTOM;for(let a=o;a<=t;a++){let s=(a-o)/Math.max(1,t-o),c=Math.round(s*1.5),f=a>=t-2&&n.walk>=0?l.trail-1:0,p=u-c+ +(a>=t-1&&n.walk>=0),m=d+c+f;for(let n=p;n<=m;n++){let s=G(n-p,m-p+1);a>o+1&&n===r.cx&&(s=Math.max(1,s-1)),a===t&&(s=Math.max(0,s-1)),e.set(n,a,i,s)}}}else for(let t=o;t<=s;t++){let r=u-+(t===s),i=d+ +(t>=s-1)+(t===s&&n.walk,0),a=c===`overalls`?B.BOTTOM:B.TOP;for(let n=r;n<=i;n++){let o=G(n-r,i-r+1);t===s&&(o=Math.max(1,o-1)),e.set(n,t,a,o)}}if(e.end(),c===`tunic`||c===`vest`||c===`tabard`){for(let t=u;t<=d;t++)e.set(t,o,B.BELT,t===u?3:t===d?1:2);e.set(u,o,B.GOLD,3)}else if(c===`robe`){for(let t=u;t<=d;t++)e.set(t,o,B.SASH,t===u?3:t===d?1:2);e.set(d+1,o+1,B.SASH,1),e.set(d+1,o+2,B.SASH,1);for(let t=a+1;t<=r.robeHem+n.bob;t++)t!==o&&e.set(u-+(t>o+2),t,B.ACCENT,3)}else if(c===`dress`){for(let t=u;t<=d;t++)e.set(t,o,B.ACCENT,2);e.set(d+1,o,B.ACCENT,1),e.set(d+2,o+1,B.ACCENT,1)}else if(c===`dancer`){for(let t=u;t<=d;t++)e.set(t,o-1,B.SKIN,t===u?3:2);for(let t=u;t<=d;t++)e.set(t,o-2,B.GOLD,3);for(let t=u-1;t<=d+1;t++)e.set(t,o,B.GOLD,3)}else if(c===`overalls`){for(let t=a+2;t<o;t++)e.set(u,t,B.BOTTOM,3),e.set(u+1,t,B.BOTTOM,2);e.set(u+2,a,B.BOTTOM,2),e.set(u+2,a+1,B.BOTTOM,2),e.set(u+1,a+2,B.GOLD,3)}if(c===`tabard`){for(let t=a;t<=s+1;t++)e.set(u,t,B.TOP,3),e.set(u+1,t,B.TOP,2);for(let t=a+1;t<o;t++)for(let n=u+2;n<=d;n++)e.set(n,t,B.METAL,n+t&1?1:2)}if(t.gear.apron)for(let t=a+1;t<=(c===`dress`?r.robeHem-1:s)+n.bob;t++)e.set(u-+(t>o+1),t,B.WHITE,3),t>o&&e.set(u-(t>o+1?0:-1),t,B.WHITE,2);return{L:u,R:d,top:a,waist:o}}function Kn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=W(n),s=Hn(n,i.child),c=0,l=i.child?2:3;n.walk===0&&(c=l),n.walk===2&&(c=-l),(n.walk===1||n.walk===3)&&(c=0);let u=i.cx-6,d=i.headY+a,f=[`staff`,`spear`,`cane`].includes(t.weapon)?t.weapon:null,p=n.act?mr(t,n,r?`right`:`left`):null;p&&fr(e,p),t.cape&&Zn(e,t,n,`back`),t.hairStyle===`long`&&t.hat;let m=e=>-2-Math.sign(e),h=null;if(p)gr(e,t,p,`behind`);else{let i=Wn(e,t,n,!1,f&&!r?m(-c):-c);f&&!r&&(h=qn(e,t,i[0]-1,i[1],f))}p&&pr(e),Un(e,t,n,s[1],!0),p&&fr(e,p),Yn(e,t,n),p&&pr(e),Un(e,t,n,s[0],!1),p&&fr(e,p);let g=Gn(e,t,n);if(t.gear.beads&&nr(e,t,n,g),t.gear.sashes){e.begin(null);for(let t=0;t<7+o.dy;t++)e.set(g.R+1+Math.floor(t/2)+(n.walk>=0?Math.floor(t/3):0),i.waist+n.bob+t,B.GOLD,2);e.end()}if(t.weapon===`sword`&&Jn(e,t,n,r),t.gear.satchel){e.begin(`all`,0);let t=r?g.R-1:g.L,n=r?[`.443`,`3332`,`.22.`]:[`4443`,`3g32`,`3322`,`.22.`];if(e.tpl(U(n,{2:[B.LEATHER,1],3:[B.LEATHER,2],4:[B.LEATHER,3],g:[B.GOLD,4]}),t,i.waist+a+1),e.end(),!r){e.begin(null);for(let t=g.top;t<i.waist+a+1;t++)e.set(g.L+2+Math.floor((t-g.top)/4),t,B.LEATHER,1);e.end()}}if(t.gear.scarf&&Xn(e,t,n,g),t.gear.pauldrons&&!i.child){e.begin(`below`,1);let t=i.cx-2,n=i.armTop+a-1;e.tpl(U([`.344.`,`34432`,`33221`],{1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3]}),t,n),e.end()}let _=p?gr(e,t,p,`under`):Wn(e,t,n,!0,f&&r?m(c):c);if(t.gear.pauldrons&&!i.child){e.begin(null);let t=i.cx-2,n=i.armTop+a-1;e.tpl(U([`.344.`,`34432`,`33221`],{1:[B.METAL,0],2:[B.METAL,1],3:[B.METAL,2],4:[B.METAL,3]}),t,n),e.end()}if(f&&r&&!p&&(h=qn(e,t,_[0]-1,_[1],f,!0)),t.gear.book&&!p&&(e.begin(`all`,1),e.tpl(U([`233`,`343`,`343`,`221`],{1:[B.BOOK,0],2:[B.BOOK,1],3:[B.BOOK,2],4:[B.WHITE,3]}),_[0]-2,_[1]-3),e.set(_[0],_[1],B.SKIN,3),e.end()),t.cape&&Zn(e,t,n,`front`),e.begin(null),e.tpl(Qt.side,u,d),yn(e,t,u,d,n),e.end(),t.hat!==`hood`){e.begin(`below`,1);let r=$t[t.hairStyle].side;if(bn(e,r.front,u,d,r.swayFrom,n.walk>=0?o.trail-1:0,Math.max(0,o.dy)),e.end(),t.hairStyle===`ponytail`){e.begin(null);let t=u+11,r=d+1;e.set(t,r,B.SCARF,3);for(let i=1;i<9+o.dy;i++){let a=t+1+Math.floor(i/3)+(n.walk>=0&&i>3?o.trail-1:0);e.set(a,r+i,B.HAIR,i%3==1?3:2),i<7&&e.set(a-1,r+i,B.HAIR,3),i>2&&i<6&&e.set(a+1,r+i,B.HAIR,1)}e.end()}}else e.begin(`below`,1),e.tpl(U([`3432`,`3.3.`],V),u+1,d+3),e.end();if(t.beard&&(e.begin(null),e.tpl(en[t.beard].side,u,d),e.end()),t.ears===`pointed`&&t.hat!==`hood`&&t.hat!==`helmet`&&$n(e,u,d),t.hat!==`none`&&tn[t.hat]&&(e.begin(t.hat===`circlet`?null:`below`,1),e.tpl(tn[t.hat].side,u,d,zn(t,tn[t.hat].side)),e.end()),t.hat===`hood`&&t.feather&&er(e,u,d,`side`),h&&f===`staff`&&(e.begin(null),kn(e,t,h.x,h.y,`staff`),e.end()),t.weapon===`lute`){e.begin(`all`,1);let t=i.cx+3,n=i.torsoTop+a+2;e.tpl(U([`.33.`,`3432`,`3432`,`3322`,`.22.`],{2:[B.WOOD,1],3:[B.WOOD,2],4:[B.WOOD,3]}),t,n);for(let r=1;r<=5;r++)e.set(t+1-Math.floor(r/3),n-r,B.WOOD,2);e.end()}p&&gr(e,t,p,`over`)}function qn(e,t,n,r,i,a=!1){let o=t.rig,s=An(i,r),c=i===`staff`?jn:0,l=e=>n-Math.round((r-e)*c);e.begin(null);for(let t=s;t<=o.ground;t++)e.set(l(t),t,B.WOOD,a?3:2);return i===`cane`?(e.set(n,s,B.WOOD,3),e.set(n-1,s-1,B.WOOD,3),e.set(n-2,s-1,B.WOOD,2),e.set(n-3,s,B.WOOD,1)):kn(e,t,l(s),s,i),e.end(),{x:l(s),y:s}}function Jn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=i.waist+a;e.begin(r?null:`all`,0);let s=i.cx-4;n.act||(e.set(s-1,o-2,B.GOLD,4),e.set(s,o-1,B.LEATHER,2)),e.set(s+1,o-1,B.GOLD,3),e.set(s+1,o,B.GOLD,2),n.act||e.set(s+1,o-2,B.GOLD,3);for(let t=0;t<9;t++){let n=s+2+t,i=o+Math.floor(t/2.5);e.set(n,i,B.LEATHER,r?1:2),e.set(n,i+1,B.LEATHER,+!r)}e.set(s+11,o+4,B.METAL,3),e.end()}function Yn(e,t,n){let r=t.rig,i=n.bob+n.br,a=r.torsoTop+i;if(t.gear.pack){e.begin(null);let t=r.cx+2,n=a-4;for(let r=n;r<=a+9;r++)for(let n=t;n<=t+6;n++)e.set(n,r,B.PACK,n===t?3:n>=t+5?1:2);for(let r=t-1;r<=t+7;r++)e.set(r,n-1,B.CAPE,3),e.set(r,n-2,B.CAPE,2),e.set(r,n,B.CAPE,1);e.set(t-1,n-1,B.CAPE,4),e.set(t-1,n-2,B.CAPE,3);for(let r=n+1;r<=a+8;r++)e.set(t+3,r,B.LEATHER,1);e.set(t+3,n+4,B.GOLD,4),e.set(t+7,a+3,B.METAL,2),e.set(t+7,a+4,B.METAL,1),e.end()}if(t.gear.quiver){e.begin(null);let t=r.cx+3;for(let n=0;n<9;n++)e.set(t+Math.floor(n/4),a-2+n,B.LEATHER,2),e.set(t+1+Math.floor(n/4),a-2+n,B.LEATHER,1);e.set(t,a-3,B.WHITE,4),e.set(t-1,a-4,B.WHITE,3),e.set(t+1,a-3,B.SCARF,3),e.set(t+1,a-4,B.SCARF,2),e.end()}if(t.weapon===`bow`&&!n.act){e.begin(null);let t=r.cx+1;for(let n=0;n<=14;n++){let r=n/14,i=t+Math.round(Math.sin(r*Math.PI)*3);e.set(i,a-3+n,B.WOOD,3)}for(let n=1;n<14;n++)e.set(t,a-3+n,B.STRING,3);e.end()}}function Xn(e,t,n,r){t.rig;let i=W(n),a=r.top;e.begin(`below`,0);for(let t=r.L;t<=r.R+1;t++)e.set(t,a-1,B.SCARF,t===r.L?4:3),e.set(t,a,B.SCARF,t===r.L?3:2);let o=n.walk>=0;for(let t=0;t<6;t++){let n=r.R+1+t,s=a+(o?Math.floor(t/3)+((t+i.sway)%2==0?0:1)-1+ +(i.dy>0):t),c=o?n:r.R+1+Math.floor(t/3);e.set(c,s+1,B.SCARF,t%2?1:2),o&&t<4&&e.set(c,s+2,B.SCARF,1)}e.end()}function Zn(e,t,n,r){let i=t.rig,a=n.bob+n.br,o=W(n),s=i.torsoTop+a,c=n.walk>=0,l=(t.cape.style===`short`?s+6:i.robeHem-+!!c)+(c?o.dy:0);if(r===`back`){e.begin(null);for(let t=s;t<=l;t++){let n=(t-s)/Math.max(1,l-s),r=Math.round(c?n*n*(1.5+o.trail):n*1.2),a=i.cx-1+(c?Math.round(n*1):0),u=i.cx+4+r;for(let n=a;n<=u;n++){let r=n===a?3:n>=u-1?1:2;if(t>s+4&&n===u-3&&(r=1),t>s+4&&n===u-4&&(r=3),t===l&&(r=Math.max(0,r-1)),c&&n===u&&t>s+3){e.set(n,t,B.CAPEIN,2);continue}e.set(n,t,B.CAPE,r)}}e.end()}else if(t.cape.style===`cloak`)e.begin(`below`,1),e.tpl(wn,i.cx,s),e.end();else{e.begin(`below`,1);let t=s;for(let n=i.cx-3;n<=i.cx+4;n++)e.set(n,t,B.CAPE,n<i.cx?3:2),e.set(n,t+1,B.CAPE,n<i.cx-1?3:1);e.set(i.cx-3,t,B.GOLD,4),e.end()}}function Qn(e,t,n,r){e.begin(null);for(let[r,i,a]of[[-1,7,3],[-1,6,2],[-2,6,3],[-2,5,4],[-3,5,3],[-3,4,4],[-4,3,3],[0,6,2],[0,7,1]])e.set(t+r,n+i,B.SKIN,a);for(let[r,i,a]of[[12,7,1],[12,6,1],[13,6,2],[13,5,2],[14,5,1],[14,4,2],[15,3,1],[11,6,1],[11,7,0]])e.set(t+r,n+i,B.SKIN,a);r||(e.set(t-1,n+6,B.SKIN,1),e.set(t+12,n+6,B.SKIN,0)),e.end()}function $n(e,t,n){e.begin(`all`,1);for(let[r,i,a]of[[13,4,3],[14,4,4],[11,5,3],[12,5,3],[13,5,2],[8,6,3],[9,6,3],[10,6,3],[11,6,2],[12,6,1],[7,7,2],[8,7,1],[9,7,1],[10,7,1],[7,8,1]])e.set(t+r,n+i,B.SKIN,a);e.set(t+9,n+7,B.BLUSH,1),e.set(t+10,n+7,B.SKIN,0),e.end()}function er(e,t,n,r){e.begin(`all`,1);let i=r===`side`?[[9,-1,3],[10,-2,4],[11,-3,3],[12,-4,1],[10,-1,2],[11,-1,3],[12,-2,3],[13,-2,1],[9,-2,2],[9,-3,3],[9,-4,1]]:r===`up`?[[4,-1,3],[3,-2,3],[2,-3,1],[6,-1,3],[6,-2,4],[6,-3,3],[6,-4,1],[8,-1,2],[9,-2,3],[10,-3,1]]:[[8,-1,3],[9,-2,4],[10,-3,3],[11,-4,1],[7,-2,3],[7,-3,4],[7,-4,1],[9,-1,2],[10,-1,3],[11,-2,3],[12,-2,1]];for(let[r,a,o]of i)e.set(t+r,n+a,o===1?B.SCARF:B.FEATHER,o===1?2:o);e.end()}function tr(e,t,n,r){let i=t.rig,a=i.torsoTop+n.bob+n.br;e.begin(null);let o=i.half*2;for(let t=0;t<o;t++){let n=i.cx-i.half+t,s=r?0:+(Math.min(t,o-1-t)>=2);e.set(n,a+s,B.BONE,t%2?2:4)}r||(e.set(i.cx-1,a+2,B.BONE,4),e.set(i.cx,a+2,B.BONE,3),e.set(i.cx-1,a+3,B.BONE,2)),e.end()}function nr(e,t,n,r){e.begin(null);for(let t=r.L;t<=r.R;t++)e.set(t,r.top+ +(t<=r.L+1),B.BONE,t%2?2:4);e.set(r.L,r.top+2,B.BONE,3),e.end()}function rr(e,t,n,r){let i=r+6,a=n+3,o=n+8;e.set(a,i,B.EYE,3),e.set(a,i+1,B.EYE,2),e.set(a+1,i+1,B.EYE,0),e.set(o,i,B.EYE,3),e.set(o,i+1,B.EYE,2),e.set(o-1,i+1,B.EYE,0),e.set(a-1,i-2,B.SKIN,0),e.set(a,i-1,B.SKIN,0),e.set(a+1,i-1,B.SKIN,0),e.set(o+1,i-2,B.SKIN,0),e.set(o,i-1,B.SKIN,0),e.set(o-1,i-1,B.SKIN,0),e.set(n+6,r+8,B.SKIN,1);for(let t=n+4;t<=n+7;t++)e.set(t,r+9,B.EYE,0);e.set(n+5,r+9,B.EYE,4)}function ir(e,t,n,r){let i=r+6;e.set(n+2,i,B.EYE,3),e.set(n+2,i+1,B.EYE,2),e.set(n+3,i+1,B.EYE,0),e.set(n+1,i-1,B.SKIN,0),e.set(n+2,i-1,B.SKIN,0),e.set(n+3,i-2,B.SKIN,0),e.set(n,r+8,B.SKIN,1),e.set(n+1,r+9,B.EYE,0),e.set(n+2,r+9,B.EYE,0),e.set(n+1,r+10,B.EYE,4)}var ar=new Set([`hurt`,`down`]),or=[{key:`wind`,bob:0,br:0,walk:-1,act:`wind`,phase:0,lag:{dy:0,sway:-1,trail:1}},{key:`slash`,bob:0,br:0,walk:-1,act:`slash`,phase:1,lag:{dy:0,sway:1,trail:3}},{key:`follow`,bob:0,br:0,walk:-1,act:`follow`,phase:2,lag:{dy:1,sway:1,trail:2}},{key:`backhand`,bob:0,br:0,walk:-1,act:`backhand`,phase:1,lag:{dy:0,sway:-1,trail:3}},{key:`thrust`,bob:1,br:0,walk:-1,act:`thrust`,phase:1,lag:{dy:0,sway:1,trail:3}},{key:`spin`,bob:0,br:0,walk:-1,act:`spin`,phase:1,lag:{dy:-1,sway:1,trail:4}},{key:`cast`,bob:0,br:-1,walk:-1,act:`cast`,phase:-1,lag:{dy:0,sway:0,trail:1}},{key:`aim`,bob:0,br:0,walk:-1,act:`aim`,phase:-1,lag:{dy:0,sway:0,trail:1}},{key:`hurt`,bob:0,br:0,walk:-1,act:`hurt`,phase:-1,lag:{dy:-1,sway:-1,trail:0}},{key:`tuck`,bob:4,br:0,walk:-1,act:`tuck`,phase:-1,lag:{dy:0,sway:0,trail:2}},{key:`roll`,bob:4,br:0,walk:-1,act:`roll`,phase:-1,lag:{dy:0,sway:0,trail:2}},{key:`down`,bob:0,br:0,walk:-1,act:`down`,phase:-1,lag:{dy:0,sway:0,trail:1}}],sr={wind:{side:{lean:[1,0],w:{h:[4,2],l:`behind`,d:[1,-.45]},o:{h:[-3,3],l:`under`},legs:`stance`},down:{w:{h:[-2,-2],d:[-.55,-1]},o:{h:[1,4]},legs:{spread:1}},up:{w:{h:[2,4],d:[.7,.8]},o:{h:[-1,4]},legs:{spread:1}}},slash:{side:{lean:[-1,0],w:{h:[-5,3],l:`under`,d:[-1,.3]},o:{h:[3,3],l:`behind`},legs:`lunge`},down:{w:{h:[7,4],d:[.9,.8]},o:{h:[-1,4]},legs:{spread:1}},up:{w:{h:[-8,-1],l:`behind`,d:[-.7,-1]},o:{h:[1,4]},legs:{spread:1}}},follow:{side:{lean:[-1,0],w:{h:[-4,5],l:`under`,d:[-.45,1]},o:{h:[3,2],l:`behind`},legs:`stance`},down:{w:{h:[9,4],d:[1,.35]},o:{h:[1,3]},legs:{spread:1}},up:{w:{h:[-9,3],l:`behind`,d:[-1,.35]},o:{h:[-1,3]},legs:{spread:1}}},backhand:{side:{lean:[0,0],w:{h:[-5,1],l:`under`,d:[-1,-.7]},o:{h:[3,4],l:`behind`},legs:`stance`},down:{w:{h:[-2,4],d:[-1,.55]},o:{h:[-1,4]},legs:{spread:1}},up:{w:{h:[0,-2],d:[.55,-1]},o:{h:[-1,4]},legs:{spread:1}}},thrust:{side:{lean:[-2,0],w:{h:[-5,2],l:`under`,d:[-1,0]},o:{h:[4,1],l:`behind`},legs:`lunge`},down:{w:{h:[4,3],d:[0,1]},o:{h:[-4,3]},legs:{spread:1,lifts:[0,1]}},up:{w:{h:[2,-2],d:[0,-1]},o:{h:[-2,3]},legs:{spread:1,lifts:[1,0]}}},spin:{side:{lean:[0,0],w:{h:[5,1],l:`behind`,d:[1,.1]},o:{h:[-5,1],l:`under`},legs:`wide`},down:{w:{h:[-3,0],d:[-1,.2]},o:{h:[3,0]},legs:{spread:2}},up:{w:{h:[3,0],d:[1,.2]},o:{h:[-3,0]},legs:{spread:2}}},cast:{side:{lean:[0,0],w:{h:[-7,-2],l:`under`,d:[-.2,-1]},o:{h:[-6,-1],l:`under`},legs:`idle`},down:{w:{h:[-3,-4],d:[0,-1]},o:{h:[3,-4]},legs:{spread:0}},up:{w:{h:[3,-4],d:[0,-1]},o:{h:[-3,-4]},legs:{spread:0}}},aim:{side:{lean:[0,0],w:{h:[1,5],l:`behind`,d:[.35,1]},o:{h:[-3,-2],l:`over`,item:`flask`},legs:`idle`},down:{w:{h:[0,5],d:[-.25,1]},o:{h:[-4,-3],l:`over`,item:`flask`},legs:{spread:0}},up:{w:{h:[0,5],d:[.25,1]},o:{h:[3,-3],l:`behind`,item:`flask`},legs:{spread:0}}},hurt:{side:{lean:[1,0],w:{h:[4,3],l:`behind`,d:[.8,.7]},o:{h:[-3,1],l:`under`},legs:`stagger`},down:{lean:[0,-1],w:{h:[-3,1],d:[-1,.8]},o:{h:[3,1]},legs:{spread:1,lifts:[1,0]}},up:{lean:[0,1],w:{h:[3,1],d:[1,.8]},o:{h:[-3,1]},legs:{spread:1,lifts:[0,1]}}},tuck:{side:{lean:[0,0],w:{h:[-2,3],l:`under`,d:[-.6,1]},o:{h:[-3,3],l:`under`},legs:`crouch`},down:{w:{h:[3,3],d:[-.7,-1]},o:{h:[-3,3]},legs:{spread:0}},up:{w:{h:[-3,3],d:[.7,-1]},o:{h:[3,3]},legs:{spread:0}}},down:{side:{lean:[0,0],w:{h:[1,5],l:`under`,d:[.2,1]},o:{h:[-1,5],l:`under`},legs:`idle`},down:{w:{h:[-1,5],d:[-.2,1]},o:{h:[1,5]},legs:{spread:0}},up:{w:{h:[1,5],d:[.2,1]},o:{h:[-1,5]},legs:{spread:0}}}},cr={aim:{side:{w:{h:[-1,0],hc:[0,1],l:`over`},o:{h:[-6,1],hc:[-7,1],l:`over`},b:[-1,.35],drawn:!0,legs:`stance`},down:{w:{h:[-3,1],hc:[5,1],l:`over`},o:{h:[-3,3],hc:[4,1],l:`over`},b:[1,.25],drawn:!0,legs:{spread:1}},up:{w:{h:[-1,0],hc:[-3,-3],l:`over`},o:{h:[2,1],hc:[-3,-2],l:`under`},b:[-1,-.3],drawn:!0,legs:{spread:1}}},follow:{side:{w:{h:[3,0],hc:[3,-3],l:`behind`},o:{h:[-6,1],hc:[-6,-4],l:`over`},b:[-1,0],drawn:!1,legs:`stance`},down:{w:{h:[-1,4],hc:[2,0]},o:{h:[-3,3],hc:[3,-2],l:`over`},b:[1,.3],drawn:!1,legs:{spread:1}},up:{w:{h:[2,2],hc:[-1,0]},o:{h:[2,1],hc:[-3,-2],l:`under`},b:[-1,-.3],drawn:!1,legs:{spread:1}}},cast:{side:{w:{h:[-2,-2],l:`over`},o:{h:[-5,-3],l:`over`},b:[-.6,-1],drawn:!0,legs:`idle`},down:{w:{h:[1,-1]},o:{h:[4,-4]},b:[.35,-1],drawn:!0,legs:{spread:0}},up:{w:{h:[-1,-1]},o:{h:[-4,-4]},b:[-.35,-1],drawn:!0,legs:{spread:0}}},thrust:{side:{lean:[-2,0],w:{h:[-4,3],l:`under`},o:{h:[-6,1],l:`under`},b:[-1,0],drawn:!1,legs:`lunge`},down:{w:{h:[4,3]},o:{h:[-4,3]},b:[-.5,1],drawn:!1,legs:{spread:1,lifts:[0,1]}},up:{w:{h:[-3,2]},o:{h:[3,2]},b:[.5,-1],drawn:!1,legs:{spread:1}}}},lr={cast:{side:{w:{h:[-4,-3],hc:[-6,-5],l:`over`,d:[-.12,-1]},o:{h:[-4,-1],hc:[-5,-3],l:`over`},legs:`idle`},down:{w:{h:[-4,-3],hc:[-3,-6],d:[0,-1]},o:{h:[4,-3],hc:[3,-4]},legs:{spread:0}},up:{w:{h:[4,-3],hc:[3,-6],d:[0,-1]},o:{h:[-4,-3],hc:[-3,-4]},legs:{spread:0}}},aim:{side:{lean:[-1,0],w:{h:[-5,1],l:`under`,d:[-1,-.4]},o:{h:[3,3],l:`behind`},legs:`stance`},down:{w:{h:[4,3],d:[.35,1]},o:{h:[1,3]},legs:{spread:1}},up:{w:{h:[0,-2],d:[.3,-1]},o:{h:[-1,3]},legs:{spread:1}}},tuck:{side:{w:{h:[-3,2],l:`under`,d:[-.2,-1]},o:{h:[-2,3],l:`under`},legs:`crouch`},down:{w:{h:[0,2],d:[0,-1]},o:{h:[-3,3]},legs:{spread:0}},up:{w:{h:[0,2],d:[0,-1]},o:{h:[3,3]},legs:{spread:0}}}};function ur(e,t){switch(e.act===`roll`?`crouch`:sr[e.act]?.side.legs??`idle`){case`stance`:return[t(-2,-3),t(2,3,0,!0)];case`lunge`:return[t(-3,-4),t(3,5,0,!0)];case`wide`:return[t(-2,-4),t(2,4)];case`stagger`:return[t(-1,-2),t(2,3,0,!0)];case`crouch`:return[t(-2,-2),t(1,1)];default:return[t(-1,-1),t(1,1)]}}function dr(e,t){let n=sr[e.act]?.[t?`up`:`down`]?.legs??{};return{spread:n.spread??0,lifts:n.lifts??[0,0]}}function fr(e,t){e.ox=t.lean[0],e.oy=t.lean[1]}function pr(e){e.ox=0,e.oy=0}function mr(e,t,n){let r=e.rig,i=n===`left`||n===`right`,a=i?`side`:n,o=sr[t.act]??sr.down,s=e.weapon===`bow`?cr[t.act]?.[a]:null,c=e.weapon===`staff`?lr[t.act]?.[a]:null,l={...o[a],...c||{},...s||{}},u=r.child?.75:1,d=r.child?.6:1,f=t.bob+t.br,p=r.armTop+f,m=e=>{if(i)return[r.cx-1,p];let t=[r.cx-r.half-2,p],a=[r.cx+r.half,p];return e===`w`==(n===`down`)?t:a},h=n===`right`,g=[];for(let e of[`w`,`o`]){let t=l[e];if(!t)continue;let[a,o]=m(e),s=a+(r.child&&t.hc?t.hc[0]:Math.round(t.h[0]*u)),c=o+(r.child&&t.hc?t.hc[1]:Math.round(t.h[1]*d)),f=i?e===`w`!==h:!1,p=t.l??`under`;i&&!f&&p===`behind`&&(p=`under`),g.push({which:e,sx:a,sy:o,hx:s,hy:c,near:!i||!f,layer:p,d:t.d??null,item:t.item??null,view:n})}let _=e.weapon===`bow`?{b:l.b??(i?[-1,0]:n===`down`?[-.5,1]:[.5,-1]),drawn:!!l.drawn}:null;return{lean:l.lean??[0,0],arms:g,bow:_,key:a,view:n,child:r.child}}function hr(e){let t=e.outfit.style;return t===`vest`||t===`overalls`?B.SHIRT:t===`tabard`?B.METAL:t===`dancer`?B.SKIN:B.TOP}function gr(e,t,n,r){let i;for(let a of n.arms)if(a.layer===r){if(_r(e,t,a),i=[a.hx,a.hy],a.which===`w`&&t.weapon!==`bow`&&xr(e,t,n,a),a.which===`o`&&t.weapon===`bow`){wr(e,t,n,a);let r=n.arms.find(e=>e.which===`w`);n.bow.drawn&&r&&Tr(e,t,n,r)}a.item===`flask`&&t.weapon!==`bow`&&t.weapon!==`staff`&&Er(e,a.hx,a.hy,n.view)}return i}function _r(e,t,n){let r=t.rig,i=hr(t),a=t.gear.gloves?B.LEATHER:B.SKIN,o=n.near&&(n.view!==`up`||n.which===`o`)?3:n.near?2:1;e.begin(n.near?`all`:null,1);let s=n.hx-n.sx,c=n.hy-n.sy,l=Math.max(Math.abs(s),Math.abs(c),1),u=Math.abs(c)>=Math.abs(s);for(let t=0;t<l;t++){let r=Math.round(n.sx+s*t/l),a=Math.round(n.sy+c*t/l),d=t===0;e.set(r,a,i,d?Math.min(4,o+1):o),u?e.set(r+1,a,i,o-1):e.set(r,a+1,i,o-1)}let d=Math.round(n.sx+s*(l-1)/l),f=Math.round(n.sy+c*(l-1)/l);t.gear.bracers&&!r.child&&(e.set(d,f,B.METAL,o),e.set(u?d+1:d,u?f:f+1,B.METAL,o-1)),t.outfit.style===`robe`&&(e.set(d,f,B.ACCENT,o),e.set(u?d+1:d,u?f:f+1,B.ACCENT,o-1)),e.set(n.hx,n.hy,a,o),e.set(n.hx+1,n.hy,a,o-1),r.child||(e.set(n.hx,n.hy+1,a,o-1),e.set(n.hx+1,n.hy+1,a,Math.max(0,o-2))),e.end()}function vr(e){let t=Math.hypot(e[0],e[1])||1;return[e[0]/t,e[1]/t]}var yr=null,br=(e,t)=>{let n=e+yr.ox,r=t+yr.oy;return n>=2&&n<=29&&r>=2&&r<=30};function xr(e,t,n,r){if(!r.d)return;let i=vr(r.d),a=r.hx+.5,o=r.hy+(n.child?0:.5);t.weapon===`sword`?Sr(e,a,o,i,n.child?4:5,r.near):(t.weapon===`staff`||t.weapon===`spear`||t.weapon===`cane`)&&Cr(e,t,a,o,i,6,2,t.weapon,r.near)}function Sr(e,t,n,r,i,a){let[o,s]=r,c=-s,l=o;e.begin(`all`,0);let u=(e,r=0)=>[Math.round(t+o*e+c*r-.5),Math.round(n+s*e+l*r-.5)],d=(t,n,r)=>{br(t[0],t[1])&&e.set(t[0],t[1],n,r)};d(u(-1.4),B.GOLD,3),d(u(1.3,-1),B.GOLD,4),d(u(1.3),B.GOLD,3),d(u(1.3,1),B.GOLD,2);for(let e=0;e<i;e++){let t=2.2+e,n=e===i-1;d(u(t),B.METAL,n?3:4),!n&&e<i-2&&Math.abs(o)>.35&&Math.abs(s)>.35&&d(u(t+.5,s>0==o>0?.6:-.6),B.METAL,a?2:1)}e.end()}function Cr(e,t,n,r,i,a,o,s,c){let[l,u]=i;e.begin(null);let d=null;for(let t=-o;t<=a;t+=.5){let i=Math.round(n+l*t-.5),a=Math.round(r+u*t-.5);br(i,a)&&(e.set(i,a,B.WOOD,c?3:2),d=[i,a])}if(e.end(),d&&s!==`cane`){e.begin(`all`,1);let[n,r]=d;if(s===`spear`)kn(e,t,n,r+0,`spear`);else{e.set(n,r,B.GEM,4),e.set(n+(l>.5?-1:1),r,B.GEM,2),e.set(n,r+(u>.5?-1:1),B.GEM,3);for(let[t,i,a]of[[-1,-1,3],[1,-1,2],[-1,1,2],[1,1,1]])br(n+t,r+i)&&e.set(n+t,r+i,B.GOLD,a)}e.end()}}function wr(e,t,n,r){let[i,a]=vr(n.bow.b),o=-a,s=i,c=n.child?5.5:6.5,l=n.child?2.4:2.8,u=r.hx+.5,d=r.hy+.5;e.begin(`all`,0);let f=[],p=e=>l*(1-e/c*(e/c))-(Math.abs(e)>c-1.2?.8:0);for(let t=-c;t<=c;t+=.5){let n=Math.round(u+o*t+i*p(t)-.5),r=Math.round(d+s*t+a*p(t)-.5);if(!br(n,r))continue;let l=Math.abs(t)<1;e.set(n,r,l?B.LEATHER:B.WOOD,l?2:Math.abs(t)>c-1.5?4:t<0?3:2)}for(let e of[-c+.5,c-.5])f.push([Math.round(u+o*e+i*p(e)-.5),Math.round(d+s*e+a*p(e)-.5)]);if(!n.bow.drawn){let[t,n]=f;e.line2(t[0],t[1],n[0],n[1],B.STRING,3)}e.end(),n.bow.tips=f,n.bow.grip=[u,d]}function Tr(e,t,n,r){let i=n.bow.tips;if(!i)return;let a=r.hx,o=r.hy;e.begin(null);for(let[t,n]of i)e.line2(t,n,a,o,B.STRING,3);let[s,c]=vr(n.bow.b),[l,u]=n.bow.grip,d=Math.hypot(l-a,u-o)+2.5;for(let t=0;t<=d;t+=.5){let n=Math.round(a+.5+s*t-.5),r=Math.round(o+.5+c*t-.5);br(n,r)&&e.set(n,r,t>d-1.5?B.METAL:B.WOOD,t>d-1.5?4:3)}e.set(a,o,B.FEATHER,3),e.end()}function Er(e,t,n,r){e.begin(`all`,0);let i=t,a=n-3;e.set(i,a,B.WOOD,3),e.set(i,a+1,B.WHITE,3),e.set(i-1,a+2,B.GEL,3),e.set(i,a+2,B.GEL,4),e.set(i+1,a+2,B.GEL,2),e.set(i-1,a+3,B.GEL,2),e.set(i,a+3,B.GEL,2),e.set(i+1,a+3,B.GEL,1),r===`up`&&e.set(i,a+2,B.GEL,2),e.end()}function Dr(e,t,n){let r=t.rig,i=r.child?.84:1,a=r.ground,o=r.cx,s=!!t.cape&&t.cape.style!==`short`,c=s?B.CAPE:B.TOP,l=s?B.TOP:B.BOTTOM,u=t.hat===`hood`?B.HAT:B.HAIR,d=t.gear.gloves?B.LEATHER:B.SKIN,f=hr(t),p=(t,n,r,i)=>{let a=Math.round(t-.5),o=Math.round(n-.5);br(a,o)&&e.set(a,o,r,i)},m=(t,n,r)=>{let i=1/0,a=-1/0,o=1/0,s=-1/0;for(let[e,n]of t)i=Math.min(i,e),a=Math.max(a,e),o=Math.min(o,n),s=Math.max(s,n);for(let c=Math.floor(o);c<=Math.ceil(s);c++)for(let o=Math.floor(i);o<=Math.ceil(a);o++){let i=!1;for(let e=0,n=t.length-1;e<t.length;n=e++){let[r,a]=t[e],[s,l]=t[n];a>c+.5!=l>c+.5&&o+.5<(s-r)*(c+.5-a)/(l-a)+r&&(i=!i)}let a=i&&br(o,c)?typeof r==`function`?r(o+.5,c+.5):r:null;a!=null&&e.set(o,c,n,a)}},h=(t,n,r,i,a,o,s=3)=>{let c=Math.max(1,Math.ceil(Math.hypot(r-t,i-n)*2)),l=a/2;for(let a=0;a<=c;a++){let u=a/c,d=t+(r-t)*u,f=n+(i-n)*u;for(let t=Math.floor(f-l);t<=Math.ceil(f+l);t++)for(let n=Math.floor(d-l);n<=Math.ceil(d+l);n++){let r=n+.5-d,i=t+.5-f;r*r+i*i>l*l+.05||!br(n,t)||e.set(n,t,o,Math.max(0,i<-l*.3?s:i>l*.35?s-2:s-1))}}},g=(t,n)=>{s&&(e.begin(`all`,0),m(t,B.CAPEIN,(e,t)=>n(e,t)?null:1),m(t,B.CAPE,(e,t)=>n(e,t)?3:null),e.end())},_=(n,r,i,a)=>{if(t.weapon!==`sword`&&t.weapon!==`staff`&&t.weapon!==`spear`)return;e.begin(`all`,0);let o=Math.max(1,Math.round(Math.hypot(i-n,a-r)));for(let e=0;e<=o;e++){let s=n+(i-n)*e/o,c=r+(a-r)*e/o;t.weapon===`sword`?p(s,c,e<2?B.GOLD:B.METAL,e<2?3:4):p(s,c,B.WOOD,3)}e.end()},v=(t,n,r,i,a,o,s=null)=>{for(let c=Math.floor(n-i);c<=Math.ceil(n+i);c++)for(let l=Math.floor(t-r);l<=Math.ceil(t+r);l++){let u=(l+.5-t)/r,d=(c+.5-n)/i;u*u+d*d>1||!o(u,d)||e.over(l,c,a,s??Math.max(1,Math.min(3,e.getShade(l,c))))}};if(n===`left`||n===`right`){let t=o-3.8*i,n=a-5.2*i,r=5.4*i,s=5*i,m=o+3*i,y=a-8*i,b=5.3*i,x=5.2*i,S=[m-.5*i,y-x*.85],C=[m+b+3.4*i,y-x-1.6*i];g([S,C,[m+b+2.6*i,y-x*.05],[m+b*.6,y+x*.3]],(e,t)=>t<S[1]+(e-S[0])*(C[1]-S[1])/(C[0]-S[0])+1.4),_(m+b*.75,y-x*.45,m-b*.7,y-x*1.15),e.begin(null),K(e,m,y,b,x,c,{hi:.35,lo:-.25}),v(m,y,b,x,l,(e,t)=>t>.35-e*.35&&e<.35),v(m,y,b,x,B.BELT,(e,t)=>t>.2-e*.35&&t<=.35-e*.35&&e<.3,1),e.end(),e.begin(`all`,0);let w=o-.5*i,T=a-1.4*i,E=o+7*i,D=a-1.4*i;h(w,T,E,D,2.8*i,B.BOTTOM,3);for(let[e,t,n]of[[.5,-1.5,3],[1.5,-1.5,2],[.5,-.5,2],[1.5,-.5,1],[.5,.5,0],[1.5,.5,0],[2.5,-2.5,2],[1.5,-2.5,3]])p(E+e*i,D+t*i,B.BOOT,n);e.end(),e.begin(`all`,1);let O=o+2.5*i,k=a-2.8*i;p(O-1,k-1,f,3),p(O,k-1,f,2),p(O,k,d,3),p(O+1,k,d,2),e.end(),e.begin(`all`,0),K(e,t,n,r,s,u,{hi:.3,lo:-.3,maxShade:4}),v(t,n,r,s,B.SKIN,(e,t)=>t>.38-e*.25&&e>-.55,null);for(let i=Math.floor(n-s);i<=Math.ceil(n+s);i++)for(let n=Math.floor(t-r);n<=Math.ceil(t+r);n++){if(e.get(n,i)!==B.SKIN)continue;let a=(n+.5-t)/r;e.set(n,i,B.SKIN,a<0?3:2)}p(t-.5*i,n+2*i,B.EYE,0),p(t+.5*i,n+2.2*i,B.EYE,0),p(t+2.5*i,n+.5*i,B.SKIN,2),p(t+2.5*i,n+1.5*i,B.SKIN,1),e.end();return}if(n!==`up`){let t=o+.5,n=a-5*i,r=5.4*i,s=4.8*i,m=o+.5,h=a-8.6*i,y=7*i,b=4.6*i;g([[m+y*.2,h-b*.6],[m+y*.55,h-b-3.4*i],[m+y+1.6*i,h-b-1.6*i],[m+y*.85,h-b*.15]],(e,t)=>e<m+y*.55+(t-h+b)*.1),e.begin(`all`,0);for(let e of[-1,1]){let t=m+e*2.4*i,n=h-b-.4*i;p(t-.5,n-.5,B.BOOT,1),p(t+.5,n-.5,B.BOOT,1),p(t-.5,n+.5,B.BOOT,e<0?3:2),p(t+.5,n+.5,B.BOOT,2)}e.end(),_(m-y*.95,h+b*.2,m-y*.45,h-b*1.1),e.begin(null),K(e,m,h,y,b,c,{hi:.35,lo:-.25}),v(m,h,y,b,l,(e,t)=>Math.abs(e)>.62&&t>.1),e.end(),e.begin(`all`,1);for(let e of[-1,1]){let a=e<0?3:2;p(t+e*(r+.6),n-1.2*i,f,a),p(t+e*(r+.4),n-.2*i,f,a-1),p(t+e*(r-.2),n+1.6*i,d,a),p(t+e*(r-1.2),n+2.8*i,d,a-1)}e.end(),e.begin(`all`,0),K(e,t,n,r,s,u,{hi:.3,lo:-.3,maxShade:4}),v(t,n,r,s,B.SKIN,(e,t)=>t>.5-Math.abs(e)*.2,null);for(let i=Math.floor(n);i<=Math.ceil(n+s);i++)for(let n=Math.floor(t-r);n<=Math.ceil(t+r);n++)e.get(n,i)===B.SKIN&&e.set(n,i,B.SKIN,n+.5<t?3:2);for(let e of[-1,1])p(t+e*2*i-.5,n+s*.72,B.EYE,0),p(t+e*2*i+.5,n+s*.72,B.EYE,0);p(t-1.2,n-1.6,u,4),p(t-.2,n-2.1,u,4),p(t-r-.2,n+.8,B.SKIN,3),p(t+r+.2,n+.8,B.SKIN,1),e.end();return}let y=o+.5,b=a-5.8*i,x=6.8*i,S=5.2*i;_(y+x*.95,b+S*.1,y+x*.4,b-S*1.15),e.begin(null),K(e,y,b,x,S,c,{hi:.35,lo:-.25}),v(y,b,x,S,B.BOTTOM,(e,t)=>t>.45&&Math.abs(e)<.62),e.end();{let t=y-.3,n=b-S*.95,r=5.2*i,a=3.4*i;e.begin(`all`,0);for(let i=Math.floor(n-a);i<=Math.floor(n);i++)for(let o=Math.floor(t-r);o<=Math.ceil(t+r);o++){let s=(o+.5-t)/r,c=(i+.5-n)/a;if(s*s+c*c>1||!br(o,i))continue;let l=-.55*s-.8*c;e.set(o,i,u,l>.6?3:l>.05?2:1)}u===B.HAIR&&(p(t-r+.6,n-.2*i,B.SKIN,2),p(t+r-.4,n-.2*i,B.SKIN,1)),e.end()}g([[y+x*.45,b+S*.05],[y+x+3.2*i,b-S*.45],[y+x+2.6*i,b+S*.4],[y+x*.6,b+S*.6]],(e,t)=>t<b+S*.05-(e-y-x)*.25),e.begin(`all`,1);for(let e of[-1,1]){let t=e<0?3:2;p(y+e*(x-.4),b+S*.1,f,t),p(y+e*(x-.9),b+S*.4,d,t)}e.end(),e.begin(`all`,0);for(let e of[-1,1]){let t=y+e*2.2*i,n=a-1.2*i;p(t-.5,n-.5,B.BOOT,e<0?3:2),p(t+.5,n-.5,B.BOOT,2),p(t-.5,n+.5,B.BOOT,0),p(t+.5,n+.5,B.BOOT,0)}e.end()}function Or(e,t){let{w:n,h:r,mat:i,shade:a}=e,o=new Uint8Array(n*r),s=new Int8Array(n*r),c=n,l=-1,u=r,d=-1;for(let e=0;e<r;e++)for(let t=0;t<n;t++){let f=e*n+t;if(!i[f])continue;let p=r-1-e,m=t;p<0||p>=n||m>=r||(o[m*n+p]=i[f],s[m*n+p]=a[f],p<c&&(c=p),p>l&&(l=p),m<u&&(u=m),m>d&&(d=m))}if(i.fill(0),a.fill(0),e.part.fill(0),l<0)return;let f=Math.round(t.rig.cx-(c+l+1)/2),p=t.rig.ground-d;for(let e=u;e<=d;e++)for(let t=c;t<=l;t++){let c=e*n+t;if(!o[c])continue;let l=t+f,u=e+p;l<1||l>n-2||u<1||u>=r-1||(i[u*n+l]=o[c],a[u*n+l]=s[c])}}function kr(e,t,n,r){let i=r+6;for(let t of[n+3,n+8])e.set(t-1,i+1,B.EYE,0),e.set(t,i+1,B.EYE,0);e.set(n+2,i,B.EYE,0),e.set(n+9,i,B.EYE,0),e.set(n+5,r+9,B.EYE,0),e.set(n+6,r+9,B.EYE,0),t.blush&&(e.set(n+2,r+8,B.BLUSH,2),e.set(n+9,r+8,B.BLUSH,2))}function Ar(e,t,n,r){let i=r+6;e.set(n+1,i+1,B.EYE,0),e.set(n+2,i+1,B.EYE,0),e.set(n+3,i,B.EYE,0),e.set(n+1,r+9,B.EYE,0),e.set(n+6,i,B.SKIN,1),e.set(n+6,i+1,B.SKIN,1),e.set(n+7,i,B.SKIN,2),e.set(n+7,i+1,B.SKIN,0)}function jr(e,t,n,r){e.clear(),yr=e,r.act===`roll`?Dr(e,t,n):n===`down`?Vn(e,t,r,!1):n===`up`?Vn(e,t,r,!0):Kn(e,t,r,n===`right`),r.act===`down`&&Or(e,t),e.ox=0,e.oy=0}function Mr(e,t){let n=ce(e,{wrap:`clamp`,mipmaps:!1,srgb:!0,name:t});return n.wrapS=n.wrapT=ye,n.generateMipmaps=!1,n.minFilter=ve,n.magFilter=ve,n}function Nr(e,{idleFps:t=2.5,walkFps:n=8,runFps:r=13,extra:i=null}={}){let a={};return g.forEach((e,o)=>{a[`idle_${e}`]={frames:[{col:0,row:o},{col:1,row:o}],fps:t,loop:!0};let s=[2,3,4,5].map(e=>({col:e,row:o}));a[`walk_${e}`]={frames:s,fps:n,loop:!0},a[`run_${e}`]={frames:s.map(e=>({...e})),fps:r,loop:!0},i&&i(a,e,o)}),a}function Pr(e={},t={}){let n=un(e),r=fn(n),i=pn.length,a=g.length,o=new I(32*i,32*a),s=new Kt(32,32);if(g.forEach((e,t)=>{pn.forEach((i,a)=>{jr(s,n,e,i),Yt(s,r,o,a*32,t*32,e===`right`)})}),t&&t.combat)return Lr(n,r,o,s);let c=o.toCanvas(),l=Mr(c,`character:${n.preset}`);return{texture:l,canvas:c,frameWidth:32,frameHeight:32,columns:i,rows:a,pixelsPerUnit:16,anchor:[.5,0],animations:Nr(a),name:n.preset,spec:n,dispose(){l.dispose()}}}var Fr=Object.freeze([`wind`,`slash`,`follow`,`backhand`,`thrust`,`spin`,`cast`,`aim`,`hurt`,`tuck`,`roll`,`down`]),Ir={attack1:[`wind`,`slash`,`follow`],attack2:[`backhand`,`follow`],attack3:[`wind`,`thrust`],spin:[`spin`],cast:[`cast`],aim:[`aim`],hurt:[`hurt`],dodge:[`tuck`,`roll`,`tuck`],down:[`down`]};function Lr(e,t,n,r){let i=g.length,a=pn.length+or.length,o=new I(32*a,32*i),s=n.width*4;for(let e=0;e<n.height;e++)o.data.set(n.data.subarray(e*s,(e+1)*s),e*o.width*4);g.forEach((n,i)=>{or.forEach((a,s)=>{jr(r,e,n,a),Yt(r,t,o,(pn.length+s)*32,i*32,n===`right`)})});let c=o.toCanvas(),l=Mr(c,`character:${e.preset}:combat`),u={};return pn.forEach((e,t)=>{u[e.key]=t}),or.forEach((e,t)=>{u[e.key]=pn.length+t}),{texture:l,canvas:c,frameWidth:32,frameHeight:32,columns:a,rows:i,pixelsPerUnit:16,anchor:[.5,0],animations:Nr(i,{extra:(e,t,n)=>{for(let[r,i]of Object.entries(Ir))e[`${r}_${t}`]={frames:i.map(e=>({col:u[e],row:n})),fps:12,loop:!1}}}),name:e.preset,spec:e,poses:u,dispose(){l.dispose()}}}function K(e,t,n,r,i,a,{lx:o=-.55,ly:s=-.8,hi:c=.5,lo:l=-.2,deep:u=-.75,maxShade:d=3,minShade:f=0}={}){for(let p=Math.floor(n-i-1);p<=Math.ceil(n+i+1);p++)for(let m=Math.floor(t-r-1);m<=Math.ceil(t+r+1);m++){let h=(m+.5-t)/r,g=(p+.5-n)/i;if(h*h+g*g>1)continue;let _=h*o+g*s,v=_>c?3:_>l?2:+(_>u);v=Math.max(f,Math.min(d,v)),e.set(m,p,a,v)}}var q={D:[B.FUR,0],d:[B.FUR,1],o:[B.FUR,2],O:[B.FUR,3],L:[B.FUR,4],s:[B.FUR2,1],S:[B.FUR2,2],c:[B.FUR3,1],C:[B.FUR3,2],w:[B.FUR3,3],W:[B.FUR3,4],e:[B.EYE,2],E:[B.EYE,0],g:[B.EYE,4],n:[B.NOSE,1],N:[B.NOSE,2],p:[B.NOSE,3],b:[B.BEAK,1],B:[B.BEAK,3],r:[B.COMB,1],R:[B.COMB,2],k:[B.LINE,0]};function Rr(e){switch(e.walk){case 0:return[{dx:-1,lift:0},{dx:1,lift:0},{dx:1,lift:0},{dx:-1,lift:0}];case 1:return[{dx:0,lift:0},{dx:0,lift:1},{dx:0,lift:1},{dx:0,lift:0}];case 2:return[{dx:1,lift:0},{dx:-1,lift:0},{dx:-1,lift:0},{dx:1,lift:0}];case 3:return[{dx:0,lift:1},{dx:0,lift:0},{dx:0,lift:0},{dx:0,lift:1}];default:return[{dx:0,lift:0},{dx:0,lift:0},{dx:0,lift:0},{dx:0,lift:0}]}}function J(e,t,n,r,i,a,o,s,c=B.FUR,l=2){let u=r-i;for(let r=n;r<=u;r++){let i=(r-n)/Math.max(1,u-n),d=Math.round(a*i);for(let n=0;n<l;n++){let i=r===u,a=i?s:c,l=n===0?2:1;o&&--l,i&&(l=o?1:2),e.set(t+d+n,r,a,Math.max(0,l))}}}function zr(e,t,{mat:n=B.FUR,stripe:r=!1,tipMat:i=null,widthBase:a=2}={}){for(let o=0;o<t.length;o++){let[s,c]=t[o],l=o/(t.length-1),u=r&&o%3==1,d=i&&o>=t.length-2?i:u?B.FUR2:n;e.set(s,c,d,u?1:2),l<.55&&a>1&&e.set(s+1,c,d,1)}}var Br=e=>e.walk===0||e.walk===1?[0,1]:e.walk===2||e.walk===3?[1,0]:[0,0];function Vr(e,t,n,r){let i=W(r),a=r.bob,o=r.key===`idle1`,s=r.walk>=0?i.sway:+(r.key===`idle1`);if(n===`side`){let t=Rr(r),n=9+a,i=[[18,n],[19,n-1],[20,n-2],[20+ +(s>0),n-3],[21+ +(s>0),n-4],[21+s,n-5],[20+s,n-6],[20+s*2,n-7]];e.begin(null),zr(e,i,{stripe:!0}),e.end(),e.begin(null),J(e,9,11+a,14,t[1].lift,t[1].dx,!0,B.FUR3),J(e,17,11+a,14,t[3].lift,t[3].dx,!0,B.FUR3),e.end(),e.begin(null),K(e,13,9.5+a,5.6,2.6,B.FUR);for(let t=9;t<=17;t+=2)e.over(t,7+a,B.FUR2,1),e.over(t,8+a,B.FUR2,1),t%4==1&&e.over(t+1,9+a,B.FUR2,1);for(let t=9;t<=16;t++)e.over(t,11+a,B.FUR3,1);e.end(),e.begin(`sides`,1),J(e,8,11+a,14,t[0].lift,t[0].dx,!1,B.FUR3),J(e,16,11+a,14,t[2].lift,t[2].dx,!1,B.FUR3),e.end();let c=3+a;e.begin(null),e.tpl(U([`..O..o....`,`.OpooDo...`,`.OOooood..`,`OOOEeoood.`,`nwwOoooodd`,`.wwwCood..`,`..wwcd....`],q),1,c),o&&(e.set(4,c+3,B.FUR,1),e.set(5,c+3,B.FUR,1)),e.end()}else if(n===`down`){let t=Br(r),n=12+a;e.begin(null),zr(e,[[15,n],[16,n-1],[17,n-2],[17+ +(s>0),n-3],[17+s,n-4],[16+s,n-5],[16+s,n-6]],{stripe:!0}),e.end(),e.begin(null),K(e,12,10.5+a,3.6,2.8,B.FUR);for(let t=9;t<=12;t++)e.over(11,t+a,B.FUR3,3),e.over(12,t+a,B.FUR3,2);e.end(),e.begin(`sides`,1),J(e,9,12+a,14,t[0],0,!1,B.FUR3),J(e,13,12+a,14,t[1],0,!1,B.FUR3),e.end();let i=2+a;e.begin(null),e.tpl(U([`.O......o.`,`.Op....po.`,`.OOooooood`,`OOOooooood`,`OOeEooEedd`,`OOoowwoood`,`.OwwnNwod.`,`..wwwwcd..`],q),7,i),e.set(11,i+2,B.FUR2,1),e.set(12,i+2,B.FUR2,1),e.set(10,i+3,B.FUR2,2),e.set(13,i+3,B.FUR2,1),o&&(e.set(9,i+4,B.FUR,1),e.set(10,i+4,B.FUR,1),e.set(13,i+4,B.FUR,1),e.set(14,i+4,B.FUR,1)),e.end()}else{let t=Br(r);e.begin(null),J(e,9,12+a,14,t[0],0,!0,B.FUR3),J(e,13,12+a,14,t[1],0,!0,B.FUR3),e.end(),e.begin(null),K(e,12,10+a,4.1,3.3,B.FUR);for(let t of[8,10,12])for(let n=9;n<=14;n++)(n!==9||t!==12)&&e.over(n,t+a,B.FUR2,n>12?1:2);e.end();let n=2+a;e.begin(`below`,1),K(e,12,n+4.2,3.7,2.9,B.FUR),e.set(8,n,B.FUR,3),e.set(8,n+1,B.FUR,3),e.set(9,n+1,B.FUR,2),e.set(9,n+2,B.FUR,2),e.set(15,n,B.FUR,2),e.set(15,n+1,B.FUR,1),e.set(14,n+1,B.FUR,1),e.set(14,n+2,B.FUR,1),e.set(11,n+3,B.FUR2,2),e.set(12,n+3,B.FUR2,1),e.set(11,n+5,B.FUR2,2),e.set(12,n+5,B.FUR2,1),e.end(),e.begin(`sides`,1),zr(e,[[11,13+a],[11,12+a],[11+(s<0?-1:0),11+a],[11+s,10+a],[11+s,9+a],[11+s*2,8+a],[11+s*2,7+a]],{stripe:!0,widthBase:2}),e.end()}}function Hr(e,t,n,r){let i=W(r),a=r.bob,o=r.walk>=0?i.sway:r.key===`idle1`?1:-1;if(n===`side`){let t=Rr(r);e.begin(null),zr(e,[[20,11+a],[21,10+a],[22,9+a],[22+ +(o>0),8+a],[22+o,7+a]],{tipMat:B.FUR3}),e.end(),e.begin(null),J(e,8,13+a,18,t[1].lift,t[1].dx,!0,B.FUR3,B.FUR,2),J(e,18,13+a,18,t[3].lift,t[3].dx,!0,B.FUR3,B.FUR,2),e.end(),e.begin(null),K(e,14,11.5+a,7,3.3,B.FUR);for(let t=8;t<=19;t++)e.over(t,14+a,B.FUR3,1);for(let t=7;t<=10;t++)for(let n=11;n<=13;n++)e.over(t,n+a,B.FUR3,t===7?3:2);e.end(),e.begin(`sides`,1),J(e,7,13+a,18,t[0].lift,t[0].dx,!1,B.FUR3,B.FUR,2),J(e,17,13+a,18,t[2].lift,t[2].dx,!1,B.FUR3,B.FUR,2),e.end();let n=3+a;e.begin(null),e.tpl(U([`...OOoo...`,`..OOoooo..`,`.OOEeoSSd.`,`OOOooSSSd.`,`wwwoooSSd.`,`nwwwooSd..`,`.wwwwod...`,`..ccc.....`],q),0,n),e.end()}else if(n===`down`){let t=Br(r);e.begin(null),zr(e,[[15,12+a],[16,11+a],[17,10+a],[17+o,9+a]],{tipMat:B.FUR3}),e.end(),e.begin(null),K(e,12,13+a,4,3.4,B.FUR);for(let t=11;t<=15;t++)e.over(11,t+a,B.FUR3,3),e.over(12,t+a,B.FUR3,2),e.over(13,t+a,B.FUR3,1);e.end(),e.begin(`sides`,1),J(e,9,15+a,18,t[0],0,!1,B.FUR3,B.FUR,2),J(e,13,15+a,18,t[1],0,!1,B.FUR3,B.FUR,2),e.end();let n=3+a;e.begin(null),e.tpl(U([`..OOoooo..`,`.OOOoooodd`,`SOOoooooSS`,`SSOEooEdSS`,`SSowwwwdSS`,`SSwwnNwdS.`,`..wwwwwd..`,`...ccc....`],q),7,n),r.key===`idle1`&&(e.set(11,n+7,B.NOSE,3),e.set(12,n+7,B.NOSE,2)),e.end()}else{let t=Br(r);e.begin(null),J(e,9,15+a,18,t[0],0,!0,B.FUR3,B.FUR,2),J(e,13,15+a,18,t[1],0,!0,B.FUR3,B.FUR,2),e.end(),e.begin(null),K(e,12,12+a,4.8,4,B.FUR);for(let t=10;t<=14;t++)for(let n=10;n<=13;n++)(t!==14||n!==10&&n!==13)&&e.over(n,t+a,B.FUR2,n<12?2:1);e.end();let n=2+a;e.begin(`below`,1),e.tpl(U([`..OOoooo..`,`.OOOoooodd`,`SOOoooooSS`,`SSOoooodSS`,`SSoooooddS`,`.S.oood.S.`],q),7,n),e.end(),e.begin(`sides`,1),zr(e,[[11,14+a],[11,13+a],[11+o,12+a],[11+o,11+a],[11+o*2,10+a]],{tipMat:B.FUR3}),e.end()}}function Ur(e,t,n,r){let i=r.bob,a=r.key===`idle1`,o=r.walk===0||r.walk===3?[0,1]:r.walk===1||r.walk===2?[1,0]:[0,0];if(n===`side`){e.begin(null),e.tpl(U([`.S`,`SS`,`sS`,`s.`],q),12,4+i),e.end(),e.begin(null);let t=[7,9];for(let n=0;n<2;n++){let a=o[n],s=r.walk===0?n===0?-1:1:r.walk===2?n===0?1:-1:0;e.vline(t[n],12+i,14-a,B.BEAK,n===0?2:1),e.set(t[n]-1+s,14-a,B.BEAK,n===0?2:1),e.set(t[n]+s,14-a,B.BEAK,n===0?3:1)}e.end(),e.begin(null),K(e,8.5,9.5+i+(a?.5:0),4.3,3.2,B.FUR,{hi:.35,lo:-.35}),e.tpl(U([`.SSS.`,`sSSSs`,`.sss.`],q),6,8+i+ +!!a),e.end();let n=a?1:3,s=a?8+i:2+i;e.begin(null),e.tpl(U([`.rR..`,`rRRR.`,`.OOo.`,`OEoo.`,`bOoo.`,`.rOo.`,`.rOd.`],q),n,s),e.set(n-1,s+4,B.BEAK,3),e.end(),a&&(e.begin(null),e.set(5,9+i,B.FUR,2),e.set(5,10+i,B.FUR,2),e.set(4,10+i,B.FUR,2),e.end())}else{let t=n===`up`;e.begin(null);for(let t=0;t<2;t++){let n=t===0?6:9;e.vline(n,12+i,14-o[t],B.BEAK,2),e.set(n-1,14-o[t],B.BEAK,2),e.set(n+1,14-o[t],B.BEAK,1)}e.end(),t&&(e.begin(null),e.tpl(U([`.SS.`,`SSSs`,`sSss`],q),6,3+i),e.end()),e.begin(null),K(e,8,9.5+i,3.7,3.3,B.FUR,{hi:.35,lo:-.35}),e.set(4,9+i,B.FUR2,2),e.set(4,10+i,B.FUR2,1),e.set(11,9+i,B.FUR2,1),e.set(11,10+i,B.FUR2,1),e.end();let r=(a&&!t?6:2)+i;e.begin(null),t?e.tpl(U([`..rR..`,`.rRRr.`,`.OOoo.`,`OOoood`,`.Oood.`],q),5,r):e.tpl(U([`..rR..`,`.rRRr.`,`.OOoo.`,`OEOoEd`,`.ObBo.`,`..rr..`],q),5,r),e.end()}}function Wr(e,t,n,r){let i=r.walk>=0?[0,-3,0,-1][r.walk]:0,a=i+ +(r.walk===0||r.walk===2),o=r.key===`idle1`;if(n===`side`){e.begin(null),e.set(11,10+a-+!!o,B.FUR2,2),e.set(12,10+a-(o?2:0),B.FUR2,1),e.set(12,11+a-+!!o,B.FUR2,1),e.end(),e.begin(null),i<-1?(e.set(8,13+a,B.BEAK,1),e.set(7,13+a,B.BEAK,1)):(e.vline(8,12+a,14,B.BEAK,1),e.set(7,14,B.BEAK,2)),e.end(),e.begin(null),K(e,8.5,10.5+a,3,2.2,B.FUR,{hi:.3,lo:-.3});for(let t=6;t<=9;t++)e.over(t,12+a,B.FUR3,2);e.set(9,9+a,B.FUR2,2),e.set(10,10+a,B.FUR2,1),e.set(9,10+a,B.FUR2,1),e.end(),e.begin(null),K(e,6,8+a,1.9,1.8,B.FUR,{hi:.2,lo:-.4}),e.set(5,8+a,B.EYE,0),e.set(6,9+a,B.FUR3,3),e.set(3,8+a,B.BEAK,3),e.set(4,8+a,B.BEAK,2),e.end()}else{let t=n===`up`;if(e.begin(null),i<-1?(e.set(6,13+a,B.BEAK,1),e.set(9,13+a,B.BEAK,1)):(e.vline(6,13+a,14,B.BEAK,1),e.vline(9,13+a,14,B.BEAK,1),e.set(5,14,B.BEAK,2),e.set(10,14,B.BEAK,1)),e.end(),t&&(e.begin(null),e.tpl(U([`.SS.`,`.Ss.`,`..s.`],q),6,12+a),e.end()),e.begin(null),K(e,8,10.8+a,3.1,2.4,B.FUR,{hi:.3,lo:-.3}),t)e.over(5,10+a,B.FUR2,2),e.over(10,10+a,B.FUR2,1),e.over(6,11+a,B.FUR2,2),e.over(9,11+a,B.FUR2,1);else for(let t=10;t<=12;t++)for(let n=6;n<=9;n++)e.over(n,t+a,B.FUR3,n<8?3:2);e.end(),e.begin(null),K(e,8,7.6+a,2.3,2,B.FUR,{hi:.2,lo:-.4}),t?(e.set(7,6+a,B.FUR2,2),e.set(8,6+a,B.FUR2,1)):(e.set(6,7+a,B.EYE,0),e.set(9,7+a,B.EYE,0),e.set(7,8+a,B.BEAK,3),e.set(8,8+a,B.BEAK,2)),e.end()}}var Gr={cat:{fw:24,fh:16,draw:Vr,idleFps:2,walkFps:9,runFps:14,colors:{fur:`#d9822b`,fur2:`#8c4a1c`,fur3:`#f2e3c4`,eyes:`#7ab04a`,nose:`#e08a8a`}},dog:{fw:28,fh:20,ox:2,draw:Hr,idleFps:3,walkFps:9,runFps:14,colors:{fur:`#a8703e`,fur2:`#5a3a24`,fur3:`#f2e3c4`,eyes:`#3a2418`,nose:`#2a1c1c`}},chicken:{fw:18,fh:16,ox:1,draw:Ur,idleFps:3,walkFps:8,runFps:12,colors:{fur:`#f4efe6`,fur2:`#b8844e`,fur3:`#fff8ee`,eyes:`#1e1418`,beak:`#e8b030`,comb:`#d23a2e`}},bird:{fw:16,fh:16,draw:Wr,idleFps:2.5,walkFps:8,runFps:12,colors:{fur:`#8a6040`,fur2:`#5a3a24`,fur3:`#e8dcc0`,eyes:`#141018`,beak:`#e0a040`}}};function Kr(e,t={}){t=cn(t);let n=xe(Gr,e)||Gr.cat,r={...n.colors,...t},i={...r,kind:e,seed:ln(t.seed??ne(String(e)))},a=Array(Gt).fill(null);a[B.FUR]=Wt(r.fur),a[B.FUR2]=Wt(r.fur2),a[B.FUR3]=Wt(r.fur3),a[B.NOSE]=Wt(r.nose||`#d08080`),a[B.BEAK]=Wt(r.beak||`#e0a040`),a[B.COMB]=Wt(r.comb||`#c83a30`);let s=o(Bt(r.eyes,`#202020`));a[B.EYE]=[z,L(z,s,.5),[...s],M(s,.3),[255,255,255,255]],a[B.LINE]=[z,z,z,z,z];for(let e=0;e<Gt;e++)a[e]||(a[e]=a[B.FUR]);let c=n.fw,l=n.fh,u=pn.length,d=g.length,f=new I(c*u,l*d),p=new Kt(c,l);p.ox=n.ox||0,g.forEach((e,t)=>{pn.forEach((r,o)=>{p.clear(),n.draw(p,i,e===`down`?`down`:e===`up`?`up`:`side`,r),Yt(p,a,f,o*c,t*l,e===`right`)})});let m=f.toCanvas(),h=Mr(m,`creature:${e}`);return{texture:h,canvas:m,frameWidth:c,frameHeight:l,columns:u,rows:d,pixelsPerUnit:16,anchor:[.5,0],name:e,animations:Nr(d,{idleFps:n.idleFps,walkFps:n.walkFps,runFps:n.runFps}),dispose(){h.dispose()}}}var qr={Painter:Kt,resolvePainter:Yt,T:U,M:B,CRE_L:q,blob:K,quadGait:Rr,quadLeg:J,tailChain:zr,rampForKind:Wt,finishTexture:Mr,buildAnimations:Nr,POSES:pn,lagOf:W,glowTexel:Ut,GLOW_ALPHA:Ht,OUTLINE:z,ERASE:qt},Y=P.outline,Jr=P.grass,Yr=P.leaves,X=P.fire;function Z(e,t,{frames:n=0,fps:r=0,smooth:i=!1}={}){let a=e.toCanvas(),o=ce(a,{wrap:`clamp`,mipmaps:!1,srgb:!0,name:`prop:${t}`});o.wrapS=o.wrapT=ye,o.generateMipmaps=!1,i&&(o.magFilter=te,o.minFilter=te);let s=n||1,c=e.width/s,l={};n&&(l.idle={frames:Array.from({length:s},(e,t)=>({col:t,row:0})),fps:r,loop:!0});let u={texture:o,canvas:a,width:c,height:e.height,pixelsPerUnit:16,anchor:[.5,0],frameWidth:c,frameHeight:e.height,sheetWidth:e.width,columns:s,rows:1,animations:l,kind:t,dispose(){o.dispose()}};return n&&(u.frames=n,u.fps=r),u}function Q(e,t,n,r,i){let a=o(r);e.set(t,n,[a[0],a[1],a[2],Math.round(_(i)*255)])}function Xr(e,t,{top:n=!0,bottom:r=!0,left:i=!0,right:a=!0,diag:o=!1}={}){let s=e.clone(),c=[];i&&c.push([1,0]),a&&c.push([-1,0]),n&&c.push([0,1]),r&&c.push([0,-1]),o&&c.push([1,1],[-1,1]);for(let n=0;n<e.height;n++)for(let r=0;r<e.width;r++)if(!(s.getAlpha(r,n)>0)){for(let[i,a]of c)if(s.getAlpha(r+i,n+a)>=128){e.set(r,n,t);break}}}function Zr(e,t,n,r,i,a,{depth:o=0,baseW:s=2,tipLight:c=!0}={}){let l=Math.max(2,Math.round(r));for(let r=0;r<=l;r++){let u=r/l,d=Math.round(t+i*u*u),f=n-r,p;p=u<.22?1:u<.5?2:u<.82?3:c?4:3,i<-.5&&u>.3&&(p=Math.min(p+1,a.length-1)),p=_(p-o,0,a.length-1),e.set(d,f,a[p]),u<.3&&s>1&&e.set(d+(i>=0?1:-1),f,a[_(p-1,0,a.length-1)])}}function Qr(e){let t=new I(16,12),n=new u(e),r=Jr,i=[];for(let e=0;e<15;e++){let t=e/14*2-1,r=Math.round(7.5+t*4+n.range(-.6,.6));i.push({bx:r,h:(10.5-Math.abs(t)*5)*n.range(.75,1.05),lean:t*n.range(2.5,4.5)+n.range(-.8,.8),depth:+(e*7%3==0)})}i.sort((e,t)=>t.depth-e.depth||e.h-t.h);for(let e of i){let n=Math.max(3,Math.round(e.h));for(let i=0;i<=n;i++){let a=i/n,o=Math.round(e.bx+e.lean*a*a),s=11-i,c=a<.2?1:a<.45?2:a<.78?3:4;e.lean<-.8&&a>.35&&(c=Math.min(5,c+1)),e.lean>1.5&&a>.5&&(c=Math.max(2,c-1)),c=_(c-e.depth,0,5),t.set(o,s,r[c]),a<.45&&t.set(o+(e.lean>=0?1:-1),s,r[_(c-1,0,5)])}}for(let e=4;e<=11;e++)t.set(e,11,r[e<6?2:1]),e>4&&e<11&&t.set(e,10,r[e<7?2:1]);return Z(t,`grass_tuft`)}function $r(e){let t=new I(16,24),n=new u(e),r=Jr,i=P.grassDry,a=[];for(let e=0;e<15;e++){let t=e/14*2-1,r=Math.round(8+t*4.5+n.range(-.6,.6));a.push({bx:r,h:(21-Math.abs(t)*9)*n.range(.7,1.05),lean:t*n.range(2.5,5)+n.range(-1.2,1.2),depth:+(e%3==1)})}a.sort((e,t)=>t.depth-e.depth);for(let e of a)Zr(t,e.bx,23,e.h,e.lean,r,{depth:e.depth});let o=[...a].sort((e,t)=>t.h-e.h).slice(0,3);for(let e of o){let n=Math.round(e.bx+e.lean),r=Math.round(23-e.h);t.set(n,r-1,i[4]),t.set(n,r-2,i[3]),t.set(n+(e.lean>0?1:-1),r-1,i[3]),t.set(n,r,i[2])}for(let e=4;e<=12;e++)t.set(e,23,r[1]),e>4&&e<12&&t.set(e,22,r[e<8?2:1]);return Z(t,`grass_tall`)}function ei(e,t,n,r,i=4){for(let a=0;a<7;a++){let o=a%2?1:-1;Zr(e,t+o*r.int(0,2),n,r.range(2.5,5.5),o*r.range(1.5,i),Jr,{depth:+(a<2),baseW:2,tipLight:a>3})}}function ti(e,t,n,r,i){let a=Math.max(1,n-i);for(let i=0;i<=a;i++){let o=i/a,s=Math.round(f(t,r,o*o));e.set(s,n-i,i<a*.4?Jr[1]:Jr[2])}}function ni(e,t,n,r,i,a={}){for(let o=0;o<t.length;o++)for(let s=0;s<t[o].length;s++){let c=t[o][s];if(c===`.`)continue;let l=a[c]??(c===`k`?Y:i[Number(c)]);l!==void 0&&e.set(n+s,r+o,l)}}function ri(e){let t=new I(13,15),n=new u(e),r=P.red;ei(t,6,14,n);let i=[[3,3],[9,2],[6,6]];for(let[e,n]of i)ti(t,6+Math.sign(e-6),13,e,n+3);for(let[e,n]of i)ni(t,[`.454.`,`45543`,`44k32`,`.332.`],e-2,n,r);return Xr(t,L(r[0],Y,.4),{top:!1,left:!1,bottom:!0,right:!0}),Z(t,`flower_red`)}function ii(e){let t=new I(12,12),n=new u(e),r=P.yellow;ei(t,6,11,n,3.5);let i=[[3,4],[6,2],[9,4],[5,6],[8,7]];for(let[e,n]of i)ti(t,6,11,e,n+1);for(let[e,n]of i)ni(t,[`454`,`343`,`.2.`],e-1,n-1,r);return Xr(t,L(r[1],Y,.35),{top:!1,left:!1,bottom:!0,right:!0}),Z(t,`flower_yellow`)}function ai(e){let t=new I(14,14),n=new u(e),r=P.white,i=P.yellow;ei(t,7,13,n);let a=[[3,3],[10,2],[7,6]];for(let[e,n]of a)ti(t,7+Math.sign(e-7),13,e+1,n+4);for(let[e,n]of a)ni(t,[`.44.`,`4ab3`,`3bc2`,`.22.`],e-1,n,r,{a:i[5],b:i[4],c:i[3]});return Xr(t,L(r[0],Y,.45),{top:!0,left:!0,bottom:!0,right:!0}),Z(t,`flower_white`)}function oi(e){let t=new I(12,14),n=new u(e),r=P.blue;ei(t,6,13,n),ti(t,5,13,3,3),ti(t,7,13,9,5);for(let[e,n]of[[3,4],[2,7],[4,8],[9,6],[10,9]])ni(t,[`.43`,`342`,`2.1`],e-1,n,r);return ni(t,[`.4.`,`453`,`.2.`],7,1,r),Xr(t,L(r[0],Y,.3),{top:!1,left:!1,bottom:!0,right:!0}),Z(t,`flower_blue`)}function si(e){let t=new I(24,18),n=new u(e),r=Yr,i=new Int8Array(432).fill(-1);for(let[t,r,a,o]of[[6,11,5,4.5],[17,11,5.5,4.5],[11.5,12,6.5,5],[8,7,4.5,4],[15,6.5,5,4.2],[11.5,5,4.5,4]]){let s=n.range(-.4,.4),c=n.range(-.3,.3);for(let n=Math.floor(r-o-1);n<=Math.ceil(r+o+1);n++)for(let l=Math.floor(t-a-1);l<=Math.ceil(t+a+1);l++){if(l<0||n<0||l>=24||n>=18)continue;let u=(l+.5-t-s)/a,f=(n+.5-r-c)/o,p=1-.18*d(l*.9,n*.9,e),m=u*u+f*f;if(m>p)continue;let h=-u*.5-f*.9-n/18*.6+.35,g=h>.65?4:h>.2?3:h>-.3?2:1;m>p*.72&&h<.3&&(g=Math.max(1,g-1)),i[n*24+l]=g}}let o=i.slice();for(let t=1;t<17;t++)for(let n=1;n<23;n++){let r=o[t*24+n];if(r<0)continue;let s=a(n,t,e);s<.11&&r>=2?(i[t*24+n]=Math.min(5,r+1),o[(t-1)*24+n+1]>=2&&(i[(t-1)*24+n+1]=Math.min(5,r+1))):s>.9&&r>=2&&r<=3&&(i[t*24+n]=r-1)}for(let e=0;e<24;e++)for(let t=15;t<18;t++)i[t*24+e]>=0&&(i[t*24+e]=t===17?0:1);for(let e=0;e<432;e++)i[e]>=0&&t.set(e%24,e/24|0,r[i[e]]);let s=n.chance(.5)?P.white:[`#8c3a5a`,`#c85a82`,`#ec8fb0`,`#f8bdd0`,`#fff0f4`];for(let e=0;e<4;e++){let e=n.int(5,18),r=n.int(3,11);t.getAlpha(e,r)&&t.getAlpha(e+1,r+1)&&(t.set(e,r,s[4]),t.set(e+1,r,s[2]),t.set(e,r+1,s[2]))}return Xr(t,L(r[0],Y,.5),{top:!1,left:!1,bottom:!0,right:!0}),Xr(t,r[1],{top:!0,left:!0,bottom:!1,right:!1}),Z(t,`bush`)}function ci(e){let t=new I(20,16),n=new u(e),r=P.green,i=P.grass[4];for(let e of[{ang:-2.75,len:8,depth:1},{ang:-.4,len:8,depth:1},{ang:-1.9,len:11,depth:1},{ang:-2.3,len:11,depth:0},{ang:-.85,len:11,depth:0},{ang:-1.45,len:12.5,depth:0}]){let a=Math.cos(e.ang)>=0?1:-1,o=9.5,s=15,c=e.ang+n.range(-.06,.06),l=Math.round(e.len/.75),u=[];for(let e=0;e<l;e++)c+=a*.05*(.2+e/l),o+=Math.cos(c)*.75,s+=Math.sin(c)*.75,u.push([o,s,c,e/l]);for(let n=1;n<u.length-1;n+=2){let[i,a,o,s]=u[n],c=s<.55?2:1;for(let n of[-1,1]){let s=o+n*1.05,l=Math.sin(s)<-.2;for(let n=1;n<=c;n++){let o=Math.round(i+Math.cos(s)*n),u=Math.round(a+Math.sin(s)*n),d=_((l?3:2)-e.depth+(n===c&&l?1:0),1,4);t.set(o,u,r[d])}}}for(let[n,i,,a]of u)t.set(Math.round(n),Math.round(i),r[_((a<.3?2:3)-e.depth,1,4)]);let d=u[u.length-1];t.set(Math.round(d[0]),Math.round(d[1]),e.depth?r[3]:i)}for(let e=7;e<=12;e++)t.set(e,15,r[e<9?2:1]);return Xr(t,L(r[0],Y,.4),{top:!1,left:!1,bottom:!0,right:!0}),Z(t,`fern`)}function li(e){let t=new I(14,26),n=new u(e),r=Jr,i=P.grassDry,a=P.brown;for(let e=0;e<7;e++){let i=3+Math.round(e*1.3+n.range(-.5,.5));Zr(t,i,25,n.range(9,17),(i-7)*n.range(.6,1.3)+n.range(-1.5,1.5),r,{depth:e%2,baseW:1})}for(let[e,n,r]of[[5,23,-1],[8,25,1],[10,19,1]]){for(let a=0;a<n;a++){let o=a/n,s=Math.round(e+r*o*o*1.5);t.set(s,25-a,o<.4?i[1]:i[2])}let o=Math.round(e+r*1.5),s=25-n;for(let e=0;e<5;e++)t.set(o,s+2+e,e===0?a[4]:a[3]),t.set(o+1,s+2+e,e===4?a[1]:a[2]);t.set(o,s+1,i[3]),t.set(o,s,i[2])}for(let e=3;e<=11;e++)t.set(e,25,r[1]);return Xr(t,L(r[0],Y,.4),{top:!1,left:!1,bottom:!0,right:!0}),Z(t,`reeds`)}function ui(e){let t=new I(13,11),n=P.red,r=P.cream,i=P.white,a=[`..3455..`,`.345W43.`,`34W44432`,`34443W32`,`.222211.`],o=(e,n,r,a)=>{for(let o=0;o<e.length;o++)for(let s=0;s<e[o].length;s++){let c=e[o][s];c!==`.`&&t.set(n+s,r+o,c===`W`?i[4]:c===`w`?i[2]:a[Number(c)])}};for(let e=5;e<=10;e++)t.set(4,e,r[4]),t.set(5,e,r[3]),t.set(6,e,r[2]);t.set(3,10,r[3]),t.set(7,10,r[1]);for(let e=7;e<=10;e++)t.set(10,e,r[4]),t.set(11,e,r[2]);return o(a,1,1,n),o([`.34.`,`3W42`,`2211`],9,5,n),t.set(2,10,Jr[3]),t.set(8,10,Jr[3]),t.set(8,9,Jr[4]),t.set(12,10,Jr[2]),t.outline(L(n[0],Y,.6)),Z(t,`mushroom`)}function di(e){let t=new I(14,9),n=P.stone,r=P.moss,i=[`....4455......`,`..344554432...`,`.3444443333...`,`3443343332232.`,`33333322222221`,`.2222221111111`,`..11111111....`];for(let e=0;e<i.length;e++)for(let r=0;r<i[e].length;r++){let a=i[e][r];a!==`.`&&t.set(r,e+1,n[Number(a)])}return t.set(6,4,n[1]),t.set(7,5,n[1]),t.set(3,2,r[3]),t.set(4,2,r[3]),t.set(5,1,r[3]),t.set(2,3,r[2]),t.set(3,3,r[2]),t.set(8,2,r[2]),t.outline(L(n[0],Y,.5)),Z(t,`rock_small`)}function fi(e,t,n,{cx:r,baseY:i,height:a,halfW:o,seed:s=0,tongues:c=3}){let l=(i-t)/a;if(l<-.15||l>1.35)return 0;let u=Math.PI*2,f=Math.sin(n*u+l*3.1+s)*.9*l+Math.sin(n*u*2+l*5.3+s*1.7)*.5*l*l,p=(e+.5-r-f)/o,m=Math.max(.05,1-Math.max(0,l)**1.25),h=1-Math.abs(p)/m,g=0;for(let t=0;t<c;t++){let i=n*u*(t%2?1:2)+t*2.1+s,a=Math.sin(i)*.55+(t-(c-1)/2)*.35,d=.75+.35*(.5+.5*Math.sin(i*1+t)),p=(e+.5-r-f)/o-a,m=.28*(1-l/d);l<d&&m>0&&(g=Math.max(g,1-Math.abs(p)/m))}h=Math.max(h,g*.85);let _=d(e*.55,(t+n*12)*.55,s,0)*.5+d(e*1.3,(t+n*24)*1.1,s+3,0)*.25;return h=h*(1.05-l*.55)+(_-.38)*.55,l<0&&(h*=1+l*5),h}function pi(e){return e>.86?X[5]:e>.68?X[4]:e>.5?X[3]:e>.33?X[2]:e>.2?X[1]:null}function mi(e,t,n,r){let{fw:i,fh:a}=r;for(let o=0;o<a;o++)for(let a=0;a<i;a++){let i=pi(fi(a,o,n,r));i&&e.set(t+a,o,i)}}function hi(e){let t=new I(192,26),n=P.wood,r=P.stone,i=(i,a)=>{let o=(e,r,a,o,s)=>{let c=Math.max(Math.abs(a-e),Math.abs(o-r));for(let l=0;l<=c;l++){let u=l/c,d=Math.round(f(e,a,u)),p=Math.round(f(r,o,u));for(let e=0;e<s;e++)t.set(i+d,p+e,n[e===0?4:e===s-1?1:2]);l%4==2&&t.set(i+d,p+1,n[1])}t.set(i+e,r,X[3]),t.set(i+e,r+1,X[2])};o(4,18,17,22,3),o(19,18,6,22,3),o(7,21,17,21,3);for(let[e,n]of[[2,22],[5,23],[9,24],[14,24],[18,23],[21,22]])t.set(i+e,n,r[4]),t.set(i+e+1,n,r[3]),t.set(i+e,n+1,r[3]),t.set(i+e+1,n+1,r[2]),t.set(i+e-1,n+1,r[2]);for(let n=0;n<7;n++){let r=7+(n*5+e)%11,o=20+n%3,s=(n+a)%3!=0;t.set(i+r,o,s?X[4]:X[2])}};for(let n=0;n<8;n++){let r=n*24;i(r,n),mi(t,r,n/8,{fw:24,fh:26,cx:12,baseY:21,height:17,halfW:5.2,seed:e%97,tongues:3});let a=4-n%4*1,o=11+n*3%4-1;n%2==0&&t.set(r+o,a,X[4]),n%4==1&&t.set(r+o+2,a+2,X[3])}return Z(t,`campfire`,{frames:8,fps:10})}function gi(e){let t=new I(60,16);for(let n=0;n<6;n++)mi(t,n*10,n/6,{fw:10,fh:16,cx:5,baseY:14,height:12,halfW:3.4,seed:11+e%13,tongues:2});return Z(t,`torch_flame`,{frames:6,fps:12})}function _i(e){let t=new I(20,8),n=[[`..5..`,`.454.`,`.454.`,`.353.`,`..3..`,`.....`],[`..4..`,`..5..`,`.454.`,`.353.`,`..3..`,`.....`],[`.....`,`..5..`,`.455.`,`.354.`,`..3..`,`.....`],[`..4..`,`.45..`,`.454.`,`.353.`,`..3..`,`.....`]];for(let e=0;e<4;e++){let r=n[e];for(let n=0;n<r.length;n++)for(let i=0;i<5;i++){let a=r[n][i];a!==`.`&&t.set(e*5+i,n+1,X[Number(a)])}t.set(e*5+2,6,`#8fb0ff`)}return Z(t,`candle_flame`,{frames:4,fps:9})}function vi(){let e=new I(17,15),t=P.white,n=P.cream;for(let r=1;r<11;r++)for(let i=1;i<16;i++){if((i===1||i===15)&&(r===1||r===10))continue;let a=r>=9?n[4]:t[4];e.set(i,r,a)}for(let t=2;t<15;t++)e.set(t,10,n[3]);for(let n=2;n<10;n++)e.set(15,n,t[2]);e.set(6,11,t[4]),e.set(7,11,n[4]),e.set(8,11,n[3]),e.set(6,12,n[4]),e.set(7,12,n[3]),e.set(6,13,n[3]);let r=t=>{e.set(t,5,Y),e.set(t+1,5,Y),e.set(t,6,Y),e.set(t+1,6,`#3a3346`)};return r(4),r(8),r(12),e.outline(Y),Z(e,`speech_bubble`)}function yi(){let e=new I(6,15),t=P.gold;return ni(e,[`4553`,`4553`,`4543`,`.443`,`.443`,`.433`,`.43.`,`.32.`,`....`,`.44.`,`4553`,`.32.`],1,1,t),e.outline(Y),Z(e,`exclamation`)}function bi(){let e=new I(11,11),t=`#ffffff`,n=X[5],r=X[4];for(let i=1;i<=5;i++){let a=1-(i-1)/5,o=i<=1?t:i<=3?n:r;for(let[t,n]of[[i,0],[-i,0],[0,i],[0,-i]])Q(e,5+t,5+n,o,Math.min(1,a*1.15))}for(let[t,r]of[[1,1],[-1,1],[1,-1],[-1,-1]])Q(e,5+t,5+r,n,.55);return Q(e,5,5,t,1),Z(e,`sparkle`)}function xi(){let e=new I(7,6),t=Yr,n=[`....45.`,`..3444.`,`.33343.`,`32233..`,`222....`,`1......`];for(let r=0;r<n.length;r++)for(let i=0;i<7;i++){let a=n[r][i];a!==`.`&&e.set(i,r,t[Number(a)])}return e.set(3,3,t[2]),Z(e,`leaf`)}function Si(){let e=new I(5,4),t=[`#8c3a5a`,`#c85a82`,`#ec8fb0`,`#f8bdd0`,`#fff0f4`],n=[`.34.`,`3443`,`2332`,`.21.`];for(let r=0;r<n.length;r++)for(let i=0;i<4;i++){let a=n[r][i];a!==`.`&&e.set(i,r,t[Number(a)])}return Z(e,`petal`)}function Ci(){let e=new I(5,5);Q(e,2,2,X[5],1);for(let[t,n]of[[1,0],[-1,0],[0,1],[0,-1]])Q(e,2+t,2+n,X[4],.95);for(let[t,n]of[[1,1],[-1,1],[1,-1],[-1,-1]])Q(e,2+t,2+n,X[3],.55);for(let[t,n]of[[2,0],[-2,0],[0,2],[0,-2]])Q(e,2+t,2+n,X[2],.3);return Z(e,`ember`)}function wi(e){let t=new I(24,24),n=new u(e),r=[[12,13,7],[8.5,11,5],[15.5,10.5,5.5],[12,8,5],[9,15,4.5],[16,15,4.5]];for(let e of r)e[0]+=n.range(-.5,.5),e[1]+=n.range(-.5,.5);for(let n=0;n<24;n++)for(let i=0;i<24;i++){let a=0,o=0;for(let[e,t,s]of r){let r=Math.hypot(i+.5-e,n+.5-t)/s;if(r<1){let c=1-r*r;a=Math.max(a,c),o=Math.max(o,c*(1-((i-e)*.4+(n-t)*.7)/s*.5))}}if(a<=.02)continue;let s=d(i*.35,n*.35,e)*.35;a=N(0,.75,a)*(.75+s);let c=_(.45+o*.45+s*.2),l=L(`#6f7480`,`#e8e6e2`,c);Q(t,i,n,l,a*.9)}return Z(t,`smoke_puff`,{smooth:!0})}function Ti(){let e=new I(4,4);return Q(e,1,1,`#fff8e6`,1),Q(e,2,1,`#fff2d0`,.8),Q(e,1,2,`#fff2d0`,.8),Q(e,2,2,`#ffe6b0`,.6),Q(e,0,1,`#ffe6b0`,.25),Q(e,3,2,`#ffe6b0`,.2),Q(e,1,0,`#ffe6b0`,.25),Q(e,2,3,`#ffe6b0`,.2),Z(e,`dust`)}function Ei(){let e=new I(32,32);for(let t=0;t<32;t++)for(let n=0;n<32;n++){let r=Math.hypot(n+.5-16,t+.5-16)/16;if(r>=1)continue;let i=(1-N(0,1,r))**1.6*.95+N(.55,.8,r)*(1-N(.8,1,r))*.08;Q(e,n,t,`#ffffff`,i)}return Z(e,`bokeh_soft`,{smooth:!0})}var Di={grass_tuft:Qr,grass_tall:$r,flower_red:ri,flower_yellow:ii,flower_white:ai,flower_blue:oi,bush:si,fern:ci,reeds:li,mushroom:ui,rock_small:di,campfire:hi,torch_flame:gi,candle_flame:_i,speech_bubble:vi,exclamation:yi,sparkle:bi,leaf:xi,petal:Si,ember:Ci,smoke_puff:wi,dust:Ti,bokeh_soft:Ei};function Oi(e,t){let n=Object.hasOwn(Di,e)?Di[e]:null;if(!n)throw Error(`createPropSprite: unknown kind "${e}"`);let r=t?t.seed:void 0;return n((r==null?ne(e):typeof r==`string`?ne(r):Number(r)||0)>>>0)}var ki=new Set,Ai=`
float luminatiBayer4( vec2 p ) {
	ivec2 q = ivec2( mod( floor( p ), 4.0 ) );
	const float M[ 16 ] = float[ 16 ]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
	return ( M[ q.y * 4 + q.x ] + 0.5 ) / 16.0;
}
`,ji=`
varying vec3 vViewPosition;
uniform float uWrap;

struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = dot( geometryNormal, directLight.direction );
	float wrapped = saturate( ( dotNL + uWrap ) / ( 1.0 + uWrap ) );
	reflectedLight.directDiffuse += wrapped * directLight.color * BRDF_Lambert( material.diffuseColor );
}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}

#define RE_Direct RE_Direct_Lambert
#define RE_IndirectDiffuse RE_IndirectDiffuse_Lambert
`,Mi=`
	{
		vec3 lnUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
		vec3 lnCam = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
		vec3 lnN = normalize( mix( lnCam, lnUp, uNormalUp ) );
		lnN = normalize( lnN + vec3( ( vQuadUv.x * 2.0 - 1.0 ) * uRoundness, 0.0, 0.0 ) );
		normal = lnN;
		nonPerturbedNormal = lnN;
	}
`,Ni=`
#ifdef USE_SHADOWMAP
	vec4 luminatiSavedWorldPosition = worldPosition;
	{
		vec3 lsH = vec3( uSunDirection.x, 0.0, uSunDirection.z );
		float lsLen = length( lsH );
		vec3 lsN = lsH / max( lsLen, 1e-4 );
		float lsSd = dot( worldPosition.xyz - ( LUMINATI_SHADOW_CENTER ), lsN );
		float lsSkip = max( 0.0, - lsSd ) / max( lsLen, 0.25 ) * uShadowSkip + uShadowSkipBias;
		worldPosition.xyz += uSunDirection * lsSkip;
	}
#endif
#include <shadowmap_vertex>
#ifdef USE_SHADOWMAP
	worldPosition = luminatiSavedWorldPosition;
#endif
`;function Pi(e,t,{shadowCenter:n=`modelMatrix[ 3 ].xyz`}={}){Object.assign(e.uniforms,t),e.uniforms.uSunDirection=R.uSunDirection,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec2 vQuadUv;
uniform vec3 uSunDirection;
uniform float uShadowSkip;
uniform float uShadowSkipBias;
#define LUMINATI_SHADOW_CENTER ${n}`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
	vQuadUv = uv;`).replace(`#include <shadowmap_vertex>`,Ni),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec2 vQuadUv;
uniform float uNormalUp;
uniform float uRoundness;`).replace(`#include <lights_lambert_pars_fragment>`,ji).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>\n${Mi}`)}function Fi(e,t){e.uniforms.uFlash=t.uFlash,e.uniforms.uGlow=t.uGlow,e.uniforms.uHighlight=t.uHighlight,e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform vec4 uFlash;
uniform vec4 uGlow;
uniform vec4 uHighlight;`).replace(`totalEmissiveRadiance *= diffuseColor.rgb;`,`totalEmissiveRadiance *= diffuseColor.rgb;
	if ( diffuseColor.a < 0.98 ) totalEmissiveRadiance += uGlow.rgb * uGlow.a * diffuseColor.rgb;`).replace(`#include <opaque_fragment>`,`#include <opaque_fragment>
	if ( uHighlight.a > 0.0 ) {
		vec3 hlBase = gl_FragColor.rgb;
		float hlLum = dot( hlBase, vec3( 0.2126, 0.7152, 0.0722 ) );
		gl_FragColor.rgb += ( hlBase * uHighlight.rgb * ( 1.0 - smoothstep( 0.45, 1.2, hlLum ) ) + uHighlight.rgb * 0.035 ) * uHighlight.a;
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, uFlash.rgb, uFlash.a );`)}function Ii(e){let t=e.source.version,n=e.clone();return n.source.version=t,n}var Li=null,Ri=0;function zi(){if(!Li){let e=document.createElement(`canvas`);e.width=32,e.height=32;let t=e.getContext(`2d`),n=t.createImageData(32,32);for(let e=0;e<32;e++)for(let t=0;t<32;t++){let r=(t+.5)/32*2-1,i=(e+.5)/32*2-1,a=1-Vi(.2,1,Math.sqrt(r*r+i*i)),o=(e*32+t)*4;n.data[o]=n.data[o+1]=n.data[o+2]=255,n.data[o+3]=Math.round(a*255)}t.putImageData(n,0,0);let r=new Te(e);r.colorSpace=``,r.generateMipmaps=!0,r.minFilter=re,r.magFilter=te;let i=new ue(1,1);i.rotateX(-Math.PI/2),Li={texture:r,geometry:i}}return Ri++,Li}function Bi(){--Ri<=0&&Li&&(Li.texture.dispose(),Li.geometry.dispose(),Li=null,Ri=0)}function Vi(e,t,n){let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}var Hi=/_(down|left|right|up)$/,Ui=new _e;function Wi(e){if(!e||e.frameWidth)return e;let t=Math.max(1,e.frames|0||1),n=e.texture&&e.texture.image,r=e.width;t>1&&n&&n.width&&Math.abs(n.width-e.width)<.5&&(r=e.width/t);let i={};if(t>1){let n=[];for(let e=0;e<t;e++)n.push({col:e,row:0});i.idle={frames:n,fps:e.fps||8,loop:!0}}return{texture:e.texture,canvas:e.canvas,frameWidth:r,frameHeight:e.height,columns:t,rows:1,pixelsPerUnit:e.pixelsPerUnit||16,anchor:e.anchor||[.5,0],animations:i}}var Gi=class e extends s{constructor(e,t={}){super(),e=Wi(e);let r={billboard:`cylindrical`,tilt:0,castShadow:!0,shadowMode:`sunFacing`,blobShadow:!0,lit:!0,alphaTest:.5,emissive:null,emissiveIntensity:1,scale:1,renderOrder:0,receiveShadow:!0,normalUp:.55,wrap:.6,roundness:.8,ditherMode:`screen`,blobSize:null,blobOpacity:.5,tint:null,animation:null,direction:`down`,combatFx:!1,...t};this.type=`Sprite3D`,this.isSprite3D=!0,this._opts=r,this.sheet=e,this._resolveCache=new Map,this.billboard=r.billboard,this.tilt=r.tilt,this.speed=1,this.playing=!0,this.animation=null,this.direction=g.includes(r.direction)?r.direction:`down`,this.finished=!1,this.onFrameChange=null,this.onAnimationEnd=null,this._anim=null,this._animKey=null,this._autoFlip=!1,this._flipX=!1,this._frame=0,this._time=0,this._col=0,this._row=0,this._opacity=1,this._bodyOpacity=1,this._shadowMode=r.shadowMode===`billboard`?`billboard`:`sunFacing`;let i=e.pixelsPerUnit||16,a=e.texture.image,o=a&&a.width||e.canvas&&e.canvas.width||e.columns*e.frameWidth,s=a&&a.height||e.canvas&&e.canvas.height||e.rows*e.frameHeight;this._frameU=e.frameWidth/o,this._frameV=e.frameHeight/s,this.texture=Ii(e.texture),this.texture.matrixAutoUpdate=!0;let[c,l]=e.anchor||[.5,0],u=e.frameWidth/i,d=e.frameHeight/i;this._size=new C(u,d);let f=new ue(u,d);if(f.translate(u*(.5-c),d*(.5-l),0),this._uniforms={uNormalUp:{value:r.normalUp},uWrap:{value:r.wrap},uRoundness:{value:r.roundness},uShadowSkip:{value:0},uShadowSkipBias:{value:.04},uDitherOpacity:{value:1},uShadowDither:{value:1},uDitherTexel:{value:+(r.ditherMode===`texel`)},uFrameSize:{value:new C(e.frameWidth,e.frameHeight)}},this._fx=!!(r.combatFx&&r.lit),this._fx&&(this._uniforms.uFlash={value:new p(0,0,0,0)},this._uniforms.uGlow={value:new p(0,0,0,0)},this._uniforms.uHighlight={value:new p(0,0,0,0)}),this.material=r.lit?this._createLitMaterial(r):this._createUnlitMaterial(r),r.tint!=null&&this.material.color.set(r.tint),this.mesh=new E(f,this.material),this.mesh.name=`Sprite3D.mesh`,this.mesh.rotation.order=`YXZ`,this.mesh.renderOrder=r.renderOrder,this.mesh.customDepthMaterial=this._createDepthMaterial(),this.add(this.mesh),this._proxyMaterial=new n({map:this.texture,alphaTest:r.alphaTest,side:2,colorWrite:!1,depthWrite:!1,fog:!1}),this.shadowProxy=new E(f,this._proxyMaterial),this.shadowProxy.name=`Sprite3D.shadowProxy`,this.shadowProxy.castShadow=!0,this.shadowProxy.receiveShadow=!1,this.shadowProxy.customDepthMaterial=this.mesh.customDepthMaterial,this.add(this.shadowProxy),this.blob=null,this._blobOpacity=r.blobOpacity,r.blobShadow){let e=zi();this._blobMaterial=new n({color:788498,map:e.texture,transparent:!0,opacity:r.blobOpacity,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});let t=r.blobSize||[Math.max(.7,u*.52),Math.max(.36,u*.26)];this.blob=new E(e.geometry,this._blobMaterial),this.blob.name=`Sprite3D.blob`,this.blob.scale.set(t[0],1,t[1]),this.blob.position.y=.012,this.blob.renderOrder=h.DECALS,this.blob.castShadow=!1,this.blob.receiveShadow=!1,this.add(this.blob)}this.scale.setScalar(r.scale),this._ready=!0,this.castShadow=r.castShadow,this.receiveShadow=r.receiveShadow;let m=r.animation||(this._resolve(`idle`)?`idle`:null);m&&this._resolve(m)?this.play(m):this._applyFrame()}_createLitMaterial(e){let t=this._uniforms,n=new we({map:this.texture,alphaTest:e.alphaTest,side:2});return e.emissive!=null&&(n.emissive.set(e.emissive),n.emissiveIntensity=e.emissiveIntensity??1),n.onBeforeCompile=e=>{Pi(e,t),e.uniforms.uDitherOpacity=t.uDitherOpacity,e.uniforms.uDitherTexel=t.uDitherTexel,e.uniforms.uFrameSize=t.uFrameSize,e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform float uDitherOpacity;
uniform float uDitherTexel;
uniform vec2 uFrameSize;
${Ai}`).replace(`#include <alphatest_fragment>`,`#include <alphatest_fragment>
	if ( uDitherOpacity < 0.999 ) {
		vec2 ldp = mix( gl_FragCoord.xy, vQuadUv * uFrameSize, uDitherTexel );
		if ( uDitherOpacity <= luminatiBayer4( ldp ) ) discard;
	}`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
	totalEmissiveRadiance *= diffuseColor.rgb;`),t.uFlash&&Fi(e,t)},n.customProgramCacheKey=t.uFlash?()=>`luminati-sprite3d-lit-fx-v1`:()=>`luminati-sprite3d-lit-v1`,n}_createUnlitMaterial(e){let t=this._uniforms,r=new n({map:this.texture,alphaTest:e.alphaTest,side:2});return e.emissive!=null&&r.color.set(e.emissive).multiplyScalar(e.emissiveIntensity??1),r.onBeforeCompile=e=>{e.uniforms.uDitherOpacity=t.uDitherOpacity,e.uniforms.uDitherTexel=t.uDitherTexel,e.uniforms.uFrameSize=t.uFrameSize,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec2 vQuadUv;`).replace(`#include <uv_vertex>`,`#include <uv_vertex>
	vQuadUv = uv;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying vec2 vQuadUv;
uniform float uDitherOpacity;
uniform float uDitherTexel;
uniform vec2 uFrameSize;
${Ai}`).replace(`#include <alphatest_fragment>`,`#include <alphatest_fragment>
	if ( uDitherOpacity < 0.999 ) {
		vec2 ldp = mix( gl_FragCoord.xy, vQuadUv * uFrameSize, uDitherTexel );
		if ( uDitherOpacity <= luminatiBayer4( ldp ) ) discard;
	}`)},r.customProgramCacheKey=()=>`luminati-sprite3d-unlit-v1`,r}_createDepthMaterial(){let e=this._uniforms,t=new de({depthPacking:Fe,map:this.texture,alphaTest:this.material.alphaTest,side:2});return t.onBeforeCompile=t=>{t.uniforms.uDitherOpacity=e.uShadowDither,t.fragmentShader=t.fragmentShader.replace(`#include <common>`,`#include <common>\nuniform float uDitherOpacity;\n${Ai}`).replace(`#include <alphatest_fragment>`,`#include <alphatest_fragment>
	if ( uDitherOpacity < 0.999 && uDitherOpacity <= luminatiBayer4( gl_FragCoord.xy ) ) discard;`)},t.customProgramCacheKey=()=>`luminati-sprite3d-depth-v1`,t}get tint(){return this.material.color}set tint(e){this.material.color.set(e)}get opacity(){return this._opacity}set opacity(e){this._opacity=e<0?0:e>1?1:e,this._applyOpacity()}get bodyOpacity(){return this._bodyOpacity}set bodyOpacity(e){this._bodyOpacity=e<0?0:e>1?1:e,this._applyOpacity()}_applyOpacity(){let e=this._opacity,t=e*this._bodyOpacity;this._uniforms.uDitherOpacity.value=t,this._uniforms.uShadowDither.value=e;let n=e>.001;this.mesh.visible=this._shadowMode===`billboard`?n:t>.001,this.blob&&(this._blobMaterial.opacity=this._blobOpacity*e,this.blob.visible=n),this._applyShadowFlags()}get flipX(){return this._flipX}set flipX(e){e=!!e,e!==this._flipX&&(this._flipX=e,this._applyFrame())}get castShadow(){return!!this._castShadow}set castShadow(e){this._castShadow=!!e,this._ready&&this._applyShadowFlags()}get receiveShadow(){return!!this._receiveShadow}set receiveShadow(e){this._receiveShadow=!!e,this._ready&&this._applyShadowFlags()}get shadowMode(){return this._shadowMode}set shadowMode(e){this._shadowMode=e===`billboard`?`billboard`:`sunFacing`,this._ready&&this._applyOpacity()}get frame(){return this._frame}setFlash(e,t,n,r){return this._fx&&this._uniforms.uFlash.value.set(e,t,n,r),this}setGlow(e,t,n,r){return this._fx&&this._uniforms.uGlow.value.set(e,t,n,r),this}setHighlight(e,t,n,r){return this._fx&&this._uniforms.uHighlight.value.set(e,t,n,r),this}get flash(){return this._fx?this._uniforms.uFlash.value.toArray():[0,0,0,0]}get highlight(){return this._fx?this._uniforms.uHighlight.value.toArray():[0,0,0,0]}get glow(){return this._fx?this._uniforms.uGlow.value.toArray():[0,0,0,0]}get size(){return this._size}_applyShadowFlags(){let e=this._castShadow&&this._opacity>.001,t=this._shadowMode===`sunFacing`;this.shadowProxy.visible=e&&t,this.mesh.castShadow=e&&!t,this.mesh.receiveShadow=!!this._receiveShadow,this._uniforms.uShadowSkip.value=e&&t?1:0}_resolve(e,t=this.direction){let n=this._resolveCache.get(e);n||(n=new Map,this._resolveCache.set(e,n));let r=n.get(t);return r===void 0&&(r=this._resolveUncached(e,t),n.set(t,r)),r}_resolveUncached(e,t){let n=this.sheet.animations||{},r=Hi.exec(e),i=r?e.slice(0,-r[0].length):e,a=r?r[1]:t;if(!r&&n[e])return{key:e,name:e,base:null,anim:n[e],flip:!1};let o=`${i}_${a}`;if(n[o])return{key:o,name:o,base:i,anim:n[o],flip:!1};let s=a===`left`?`right`:a===`right`?`left`:null;return s&&n[`${i}_${s}`]?{key:`${i}_${s}`,name:o,base:i,anim:n[`${i}_${s}`],flip:!0}:r&&n[e]?{key:e,name:e,base:i,anim:n[e],flip:!1}:null}play(e,t={}){let{restart:n=!1,speed:r,keepPhase:a=!1}=t,o=this._resolve(e);return o?o.name===this.animation&&!n&&!this.finished?(r!==void 0&&(this.speed=r),this.playing=!0,this):(this.speed=r===void 0?1:r,this._setAnimation(o,!a||n||this.finished),this.playing=!0,this):(ki.has(e)||(ki.add(e),console.warn(`Sprite3D: unknown animation "${i(e)}"`)),this)}_setAnimation(e,t){if(this._anim=e.anim,this._animKey=e.key,this._autoFlip=e.flip,this.animation=e.name,e.base!==null){let t=Hi.exec(e.name);t&&(this.direction=t[1])}let n=Math.max(1,e.anim.frames.length);t?(this._frame=0,this._time=0,this.finished=!1):this._frame%=n;let r=e.anim.frames[this._frame]||e.anim.frames[0];r&&(this._col=r.col,this._row=r.row),this._applyFrame()}setDirection(e){if(e===this.direction||!g.includes(e))return this;if(this.direction=e,this.animation){let t=Hi.exec(this.animation);if(t){let n=this._resolve(`${this.animation.slice(0,-t[0].length)}_${e}`,e);n&&this._setAnimation(n,!1)}}return this}faceVector(t,n,r=R.uCameraYaw.value){let i=e.directionFromVector(t,n,r,this.direction);return this.setDirection(i)}setFrame(e,t){return this._col=e,this._row=t,this._autoFlip=!1,this._anim=null,this._animKey=null,this.animation=null,this.finished=!1,this._frame=0,this._time=0,this.playing=!1,this._applyFrame(),this}_applyFrame(){let e=this.texture,t=this._frameU,n=this._frameV,r=this._flipX!==this._autoFlip;e.repeat.set(r?-t:t,n),e.offset.set((this._col+ +!!r)*t,1-(this._row+1)*n)}update(e,t){let n=this._anim;if(this.playing&&n&&n.frames.length>0){let t=n.fps>0?n.fps:8;this._time+=e*this.speed;let r=1/t;if(this._time>=r){let e=Math.floor(this._time/r);this._time-=e*r;let t=n.frames.length,i=this._frame+e;if(i>=t&&(n.loop===!1?(i=t-1,this.playing=!1,this.finished||(this.finished=!0,this.onAnimationEnd&&this.onAnimationEnd(this.animation))):i%=t),i!==this._frame){this._frame=i;let e=n.frames[i];this._col=e.col,this._row=e.row,this._applyFrame(),this.onFrameChange&&this.onFrameChange(i,this.animation)}}}let r=R.uCameraYaw.value,i=this.rotation.y;if(this.billboard===`cylindrical`||this.billboard===`spherical`&&!t){let e=0;if(t&&this.tilt!==0){let n=t.matrixWorld.elements[9];e=Math.asin(n<-1?-1:n>1?1:n)}this.mesh.rotation.set(-e*this.tilt,r-i,0)}else this.billboard===`spherical`&&(Ui.setFromRotationMatrix(t.matrixWorld),this.mesh.quaternion.copy(this.quaternion).invert().multiply(Ui));if(this.shadowProxy.visible){let e=R.uSunDirection.value;e.x*e.x+e.z*e.z>1e-8&&(this.shadowProxy.rotation.y=Math.atan2(e.x,e.z)-i)}this.blob&&(this.blob.rotation.y=r-i)}static directionFromVector(e,t,n=0,r=`down`){let i=Math.cos(n),a=Math.sin(n),o=e*i-t*a,s=e*a+t*i,c=Math.abs(o),l=Math.abs(s);if(c<1e-6&&l<1e-6)return r;let u=r===`left`||r===`right`,d=1.15;return(u?c*d>=l:c>l*d)?o>0?`right`:`left`:s>0?`down`:`up`}clone(){let e=new this.constructor(this.sheet,{...this._opts,animation:null,direction:this.direction});return e.name=this.name,e.visible=this.visible,e.position.copy(this.position),e.quaternion.copy(this.quaternion),e.scale.copy(this.scale),e.billboard=this.billboard,e.tilt=this.tilt,e.tint.copy(this.tint),this.material.emissive&&e.material.emissive&&(e.material.emissive.copy(this.material.emissive),e.material.emissiveIntensity=this.material.emissiveIntensity),e.flipX=this.flipX,e.opacity=this.opacity,e.bodyOpacity=this.bodyOpacity,e.shadowMode=this.shadowMode,e.castShadow=this.castShadow,e.receiveShadow=this.receiveShadow,this._fx&&(e._uniforms.uFlash.value.copy(this._uniforms.uFlash.value),e._uniforms.uGlow.value.copy(this._uniforms.uGlow.value),e._uniforms.uHighlight.value.copy(this._uniforms.uHighlight.value)),this.animation?e.play(this.animation,{speed:this.speed}):e.setFrame(this._col,this._row),e.playing=this.playing,e}dispose(){this.parent&&this.parent.remove(this),this.mesh.geometry.dispose(),this.material.dispose(),this.mesh.customDepthMaterial.dispose(),this._proxyMaterial.dispose(),this.texture.dispose(),this.blob&&(this._blobMaterial.dispose(),this.blob=null,Bi()),this._anim=null,this.onFrameChange=null,this.onAnimationEnd=null}},Ki=class{constructor({capacity:e=256}={}){this.capacity=e,this.mesh=null,this.sprites=[],this._alpha=null}adopt(e){let t=e?.blob;return!t||this.sprites.includes(e)?!1:(this.mesh||this._create(t),t.layers.disable(0),this.sprites.push(e),!0)}release(e){let t=this.sprites.indexOf(e);return t<0?!1:(this.sprites.splice(t,1),e.blob?.layers.enable(0),!0)}update(){let e=this.mesh;if(!e)return;let t=this._alpha.array,n=0;for(let r=0;r<this.sprites.length&&n<this.capacity;r++){let i=this.sprites[r].blob;if(!i||!qi(i))continue;let a=i.material.opacity;a>.001&&(i.updateWorldMatrix(!0,!1),e.setMatrixAt(n,i.matrixWorld),t[n]=a,n++)}e.count=n,e.instanceMatrix.needsUpdate=!0,this._alpha.needsUpdate=!0}dispose(){for(let e of this.sprites)e.blob?.layers.enable(0);this.sprites.length=0,this.mesh&&=(this.mesh.removeFromParent(),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.mesh.dispose?.(),null)}_create(e){let t=e.material,r=e.geometry.clone();this._alpha=new be(new Float32Array(this.capacity),1),this._alpha.setUsage(je),r.setAttribute(`aBlobAlpha`,this._alpha);let i=new n({color:t.color.clone(),map:t.map,transparent:!0,opacity:1,depthWrite:!1,polygonOffset:t.polygonOffset,polygonOffsetFactor:t.polygonOffsetFactor,polygonOffsetUnits:t.polygonOffsetUnits,fog:t.fog});i.name=`luminati:blob-batch`,i.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
attribute float aBlobAlpha;
varying float vBlobAlpha;`).replace(`#include <begin_vertex>`,`#include <begin_vertex>
	vBlobAlpha = aBlobAlpha;`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
varying float vBlobAlpha;`).replace(`#include <alphamap_fragment>`,`#include <alphamap_fragment>
	diffuseColor.a *= vBlobAlpha;`)},i.customProgramCacheKey=()=>`luminati-blob-batch`;let a=new w(r,i,this.capacity);a.name=`BlobBatch`,a.instanceMatrix.setUsage(je),a.count=0,a.renderOrder=e.renderOrder,a.castShadow=!1,a.receiveShadow=!1,a.frustumCulled=!1,a.matrixAutoUpdate=!1,this.mesh=a}};function qi(e){for(let t=e;t;t=t.parent){if(!t.visible)return!1;if(t.isScene)return!0}return!1}var Ji=`
uniform float uTime;
uniform float uCameraYaw;
uniform vec2 uWind;
uniform float uWindStrength;
uniform float uFoliageWind;
uniform float uAnchorY;
uniform float uQuadHeight;
uniform float uFrameU;
#ifdef LUMINATI_FACE_SUN
uniform vec3 uSunDirection;
#endif
attribute float aFrame;

float luminatiFoliageYaw() {
#ifdef LUMINATI_FACE_SUN
	vec2 sh = uSunDirection.xz;
	return dot( sh, sh ) > 1e-8 ? atan( sh.x, sh.y ) : uCameraYaw;
#else
	return uCameraYaw;
#endif
}

vec3 luminatiYawRotate( vec3 v, float yaw ) {
	float c = cos( yaw );
	float s = sin( yaw );
	return vec3( v.x * c + v.z * s, v.y, - v.x * s + v.z * c );
}
`,Yi=`
	vec3 transformed = luminatiYawRotate( vec3( position ), luminatiFoliageYaw() );
	{
		vec3 lfPos = vec3( 0.0 );
		float lfScale = 1.0;
		#ifdef USE_INSTANCING
			lfPos = instanceMatrix[ 3 ].xyz;
			lfScale = max( length( instanceMatrix[ 0 ].xyz ), 1e-4 );
		#endif
		float lfW = clamp( ( uv.y - uAnchorY ) / max( 1.0 - uAnchorY, 1e-3 ), 0.0, 1.0 );
		float lfWindLen = length( uWind );
		vec2 lfDir = lfWindLen > 1e-4 ? uWind / lfWindLen : vec2( 1.0, 0.0 );
		float lfHash = fract( sin( dot( lfPos.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
		float lfWave = dot( lfPos.xz, lfDir ) * 0.42 - uTime * ( 1.25 + lfWindLen * 0.55 );
		float lfGust = 0.5 + 0.5 * sin( lfWave ) + 0.25 * sin( lfWave * 0.37 + 1.7 );
		lfGust = lfGust * lfGust;
		float lfFlutter = sin( uTime * ( 2.1 + lfHash * 1.9 ) + lfHash * 6.2831 );
		float lfAmt = uWindStrength * uFoliageWind * ( 0.03 + 0.06 * lfWindLen ) * uQuadHeight * lfScale;
		vec2 lfSway = lfDir * lfAmt * ( 0.3 + lfGust * 1.1 + lfFlutter * 0.25 )
			+ vec2( - lfDir.y, lfDir.x ) * lfAmt * lfFlutter * 0.3;
		transformed.xz += lfSway * lfW / lfScale;
		transformed.y -= dot( lfSway, lfSway ) * lfW / ( lfScale * max( uQuadHeight * lfScale, 0.2 ) ) * 0.5;
	}
`,Xi=class{constructor(e){let{sprite:t,instances:n,wind:r=1,castShadow:i=!1,receiveShadow:a=!0,alphaTest:o=.5,normalUp:s=.8,wrap:c=.5,roundness:l=.25,rootDarken:d=.35,randomFrames:f=!1,variance:p=.08,seed:m=1,name:h=`Foliage`}=e,g=t.pixelsPerUnit||16,_=Math.max(1,t.frames|0||1),v=t.texture.image,y=t.width;_>1&&v&&v.width&&Math.abs(v.width-t.width)<.5&&(y=t.width/_);let b=t.height,[x,S]=t.anchor||[.5,0],C=y/g,T=b/g,E=n.length,D=new ue(C,T);D.translate(C*(.5-x),T*(.5-S),0);let O=new be(new Float32Array(Math.max(1,E)),1);D.setAttribute(`aFrame`,O),this._ownsTexture=_>1,this.texture=_>1?Ii(t.texture):t.texture,_>1&&(this.texture.repeat.set(1/_,1),this.texture.offset.set(0,0)),this._uniforms={uTime:R.uTime,uCameraYaw:R.uCameraYaw,uWind:R.uWind,uWindStrength:R.uWindStrength,uFoliageWind:{value:r},uAnchorY:{value:S},uQuadHeight:{value:T},uFrameU:{value:1/_},uRootDarken:{value:d},uNormalUp:{value:s},uWrap:{value:c},uRoundness:{value:l},uShadowSkip:{value:+!!i},uShadowSkipBias:{value:i?.03:0}};let k=this._uniforms,A=new we({map:this.texture,alphaTest:o,side:2});A.onBeforeCompile=e=>{Pi(e,k,{shadowCenter:`( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz`}),Object.assign(e.uniforms,k),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${Ji}`).replace(`#include <beginnormal_vertex>`,`#include <beginnormal_vertex>
	objectNormal = luminatiYawRotate( objectNormal, luminatiFoliageYaw() );`).replace(`#include <begin_vertex>`,Yi).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
	vMapUv.x += aFrame * uFrameU;
#endif`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform float uRootDarken;`).replace(`#include <map_fragment>`,`#include <map_fragment>
	diffuseColor.rgb *= mix( 1.0 - uRootDarken, 1.0, smoothstep( 0.0, 0.6, vQuadUv.y ) );`)},A.customProgramCacheKey=()=>`luminati-foliage-lit-v1`,this.material=A;let j=new de({depthPacking:Fe,map:this.texture,alphaTest:o,side:2});j.onBeforeCompile=e=>{Object.assign(e.uniforms,k),e.uniforms.uSunDirection=R.uSunDirection,e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n#define LUMINATI_FACE_SUN\n${Ji}`).replace(`#include <begin_vertex>`,Yi).replace(`#include <uv_vertex>`,`#include <uv_vertex>
#ifdef USE_MAP
	vMapUv.x += aFrame * uFrameU;
#endif`)},j.customProgramCacheKey=()=>`luminati-foliage-depth-v1`,this.depthMaterial=j,this.object=new w(D,A,Math.max(1,E)),this.object.name=h,this.object.count=E,this.object.customDepthMaterial=j,this.object.castShadow=i,this.object.receiveShadow=a;let M=new u(m),ee=new ae,te=new F,ne=0;for(let e=0;e<E;e++){let t=n[e],r=t.scale??1;ne=Math.max(ne,r),ee.makeScale(r,r,r),ee.setPosition(t.x,t.y??0,t.z),this.object.setMatrixAt(e,ee),t.tint==null?te.setRGB(1,1,1):te.set(t.tint),p>0&&te.multiplyScalar(1+(M.next()*2-1)*p),this.object.setColorAt(e,te);let i=t.frame;i??=f?Math.floor(M.next()*_):0,O.array[e]=Math.min(_-1,Math.max(0,i|0))}this.object.instanceMatrix.needsUpdate=!0,this.object.instanceColor&&(this.object.instanceColor.needsUpdate=!0),O.needsUpdate=!0,E>0&&(this.object.computeBoundingSphere(),this.object.boundingSphere.radius+=Math.hypot(C,T)*Math.max(1,ne)+.5),this.count=E}get castShadow(){return this.object.castShadow}set castShadow(e){this.object.castShadow=!!e,this._uniforms.uShadowSkip.value=+!!e,this._uniforms.uShadowSkipBias.value=e?.03:0}get receiveShadow(){return this.object.receiveShadow}set receiveShadow(e){this.object.receiveShadow=!!e}get wind(){return this._uniforms.uFoliageWind.value}set wind(e){this._uniforms.uFoliageWind.value=e}update(){}dispose(){this.object.parent&&this.object.parent.remove(this.object),this.object.geometry.dispose(),this.material.dispose(),this.depthMaterial.dispose(),this._ownsTexture&&this.texture.dispose(),this.object.dispose()}},Zi={dust:{mode:`area`,motion:`drift`,texture:`glow`,blending:`additive`,count:90,life:[5,10],size:[.06,.12],sizeEnd:1,velocity:[0,.05,0],velocityVariance:[.07,.04,.07],windInfluence:.12,turbulence:[.3,.35],color:`#ffe0a0`,hdr:2.4,alpha:.85,fade:[.25,.3],twinkle:1,nightVisibility:-.85,bounds:[14,4,14]},fireflies:{mode:`area`,motion:`drift`,texture:`glow`,blending:`additive`,count:36,life:[8,14],size:[.2,.3],sizeEnd:1,velocity:[0,0,0],velocityVariance:[.1,.04,.1],windInfluence:.04,turbulence:[.8,.3],color:`#b6ff3c`,colorEnd:`#ffd23c`,hdr:2.4,alpha:1,fade:[.15,.2],blink:1,nightVisibility:1,bounds:[10,2.2,10]},embers:{mode:`point`,motion:`emit`,texture:`square`,blending:`additive`,count:34,life:[.9,2.2],size:[.07,.11],sizeEnd:.35,spawnSize:[.6,.15,.6],velocity:[0,1.5,0],velocityVariance:[.3,.55,.3],radial:.12,gravity:.5,drag:.7,windInfluence:.35,turbulence:[.3,5],color:`#ff8a2a`,colorEnd:`#ff3a12`,hdr:2.4,alpha:1,fade:[.04,.35],twinkle:.35},smoke:{mode:`point`,motion:`emit`,texture:`smoke`,blending:`normal`,count:22,life:[3.5,6],size:[.45,.7],sizeEnd:4.2,spawnSize:[.25,.1,.25],velocity:[0,.8,0],velocityVariance:[.1,.15,.1],gravity:.06,drag:.3,windInfluence:.22,turbulence:[.25,1.2],spin:[.1,.4],color:`#d2cdc8`,colorEnd:`#8d8b92`,alpha:.5,fade:[.12,.55],lit:1},leaves:{mode:`area`,motion:`fall`,texture:`leaf`,blending:`cutout`,count:24,size:[.46,.54],velocity:[0,-.75,0],velocityVariance:[0,.3,0],windInfluence:.45,turbulence:[.55,1.6],spin:[1.2,3],tumble:1,colors:[`#e0752f`,`#f2b04a`,`#b8462a`,`#86ad48`],alpha:1,fade:[.06,.12],lit:1,bounds:[10,6,10]},petals:{mode:`area`,motion:`fall`,texture:`petal`,blending:`cutout`,count:40,size:[.3,.36],velocity:[0,-.5,0],velocityVariance:[0,.3,0],windInfluence:.8,turbulence:[.75,1.3],spin:[1,2.6],tumble:1,colors:[`#f7b3c7`,`#ffd8e3`,`#fff4f6`,`#f28fb0`],alpha:1,fade:[.06,.12],lit:1,bounds:[10,5,10]},rain:{mode:`area`,motion:`precip`,texture:`streak`,blending:`normal`,followCamera:!0,count:1600,size:[.035,.05],aspect:12,streak:.03,velocity:[0,-15,0],velocityVariance:[0,.12,0],windInfluence:.9,color:`#c4d8f6`,alpha:.5,lit:.6,bounds:[36,16,36]},snow:{mode:`area`,motion:`precip`,texture:`snow`,blending:`normal`,followCamera:!0,count:1100,size:[.08,.13],velocity:[0,-1,0],velocityVariance:[0,.35,0],windInfluence:.45,turbulence:[.35,1.1],spin:[.5,.5],color:`#ffffff`,alpha:.95,lit:.75,bounds:[34,14,34]},mist:{mode:`point`,motion:`emit`,texture:`smoke`,blending:`normal`,count:34,life:[1.6,3],size:[.6,.9],sizeEnd:3.2,spawnSize:[2,.3,.4],velocity:[0,.35,.45],velocityVariance:[.45,.3,.35],radial:.5,gravity:.05,drag:1,windInfluence:.2,turbulence:[.2,1.5],spin:[.1,.5],color:`#eef8ff`,colorEnd:`#d2e6f4`,alpha:.28,fade:[.15,.6],lit:.9},footstep:{mode:`burst`,motion:`emit`,texture:`smoke`,blending:`normal`,count:8,life:[.35,.65],size:[.14,.22],sizeEnd:2.2,spawnSize:[.3,.02,.14],burstSpeed:[.5,1.1],burstUp:[.15,.45],gravity:-.3,drag:5,windInfluence:.1,spin:[.5,2],color:`#d6bf98`,alpha:.7,fade:[.05,.6],lit:1},splash:{mode:`burst`,motion:`emit`,texture:`square`,blending:`normal`,count:16,life:[.45,.8],size:[.07,.12],sizeEnd:.6,spawnSize:[.3,.02,.3],burstSpeed:[.8,2.2],burstUp:[2.2,4.2],gravity:-9.8,drag:.4,ballistic:!0,color:`#e8f6ff`,hdr:1.4,alpha:.95,fade:[0,.3],lit:.5},sparkle:{mode:`burst`,motion:`emit`,texture:`star`,blending:`additive`,count:10,life:[.45,1],size:[.28,.5],sizeEnd:.9,pulse:1,spawnSize:[.8,.8,.8],burstSpeed:[.2,.8],burstUp:[.2,.8],velocity:[0,.12,0],gravity:.2,drag:2,spin:[.5,2],color:`#fff6d0`,hdr:6,alpha:1,fade:[.05,.3],bounds:[4,1,4]},hitSpark:{mode:`burst`,motion:`emit`,texture:`streak`,blending:`additive`,variants:1,lit:0,pulse:0,tumble:0,aspect:4,streak:.04,fade:[0,.3],twinkle:0,blink:0,nightVisibility:0,count:8,life:[.12,.25],size:[.05,.08],sizeEnd:.6,spawnSize:[.1,.1,.1],burstSpeed:[3,7],burstUp:[.5,2],gravity:-8,drag:4,color:`#fff2c0`,colorEnd:`#ff9a3c`,hdr:4,alpha:1},emberBurst:{mode:`burst`,motion:`emit`,texture:`streak`,blending:`additive`,variants:1,lit:0,pulse:0,tumble:0,aspect:4,streak:.04,fade:[0,.3],twinkle:0,blink:0,nightVisibility:0,count:10,life:[.4,.9],size:[.05,.09],sizeEnd:.5,spawnSize:[.4,.2,.4],burstSpeed:[1,3],burstUp:[1,3],gravity:1.5,drag:1,colors:[`#ff8a2a`,`#ff3a12`,`#ffd27a`],hdr:3,alpha:1},deathPoof:{mode:`burst`,motion:`emit`,texture:`smoke`,blending:`normal`,variants:1,lit:1,pulse:0,tumble:0,aspect:1,streak:0,fade:[.05,.6],twinkle:0,blink:0,nightVisibility:0,count:10,life:[.4,.8],size:[.5,.5],sizeEnd:2.2,spawnSize:[.5,.3,.5],burstSpeed:[.6,1.4],burstUp:[.3,.8],drag:4,spin:[.5,2],color:`#d8d0c0`,alpha:.7},gooPoof:{mode:`burst`,motion:`emit`,texture:`smoke`,blending:`normal`,variants:1,lit:1,pulse:0,tumble:0,aspect:1,streak:0,fade:[.05,.6],twinkle:0,blink:0,nightVisibility:0,count:10,life:[.4,.8],size:[.5,.5],sizeEnd:2.2,spawnSize:[.5,.3,.5],burstSpeed:[.6,1.4],burstUp:[.3,.8],drag:4,spin:[.5,2],color:`#5fc7b0`,alpha:.7},healGlow:{mode:`burst`,motion:`emit`,texture:`star`,blending:`additive`,variants:1,lit:0,pulse:1,tumble:0,aspect:1,streak:0,fade:[.05,.3],twinkle:0,blink:0,nightVisibility:0,count:8,life:[.5,1],size:[.2,.35],sizeEnd:.8,spawnSize:[.6,.8,.6],velocity:[0,1.2,0],burstSpeed:[.2,.6],burstUp:[0,.3],drag:1,color:`#bfe58f`,hdr:2.4,alpha:1},magicBurst:{mode:`burst`,motion:`emit`,texture:`star`,blending:`additive`,variants:1,lit:0,pulse:1,tumble:0,aspect:1,streak:0,fade:[.05,.3],twinkle:0,blink:0,nightVisibility:0,count:12,life:[.4,.8],size:[.25,.45],sizeEnd:.7,spawnSize:[.3,.3,.3],burstSpeed:[2,5],burstUp:[-.5,.5],drag:3,colors:[`#8fd0ff`,`#f3cf7a`],hdr:3.5,alpha:1},victoryEmbers:{mode:`burst`,motion:`emit`,texture:`streak`,blending:`additive`,variants:1,lit:0,pulse:0,tumble:0,aspect:4,streak:.04,fade:[0,.3],twinkle:0,blink:0,nightVisibility:0,count:12,life:[.7,1.3],size:[.05,.08],sizeEnd:.5,spawnSize:[1,.8,.6],burstSpeed:[.3,1.1],burstUp:[1.6,3.2],gravity:1.2,drag:1.4,colors:[`#ff8a2a`,`#ff3a12`,`#ffd27a`],hdr:1.5,alpha:1},victorySparkle:{mode:`burst`,motion:`emit`,texture:`star`,blending:`additive`,variants:1,lit:0,pulse:1,tumble:0,aspect:1,streak:0,fade:[.05,.3],twinkle:0,blink:0,nightVisibility:0,count:12,life:[.6,1.1],size:[.16,.3],sizeEnd:.8,spawnSize:[1.4,1,.8],velocity:[0,.5,0],burstSpeed:[.15,.6],burstUp:[.2,.8],gravity:.2,drag:2,spin:[.5,2],color:`#fff0c8`,hdr:1.15,alpha:1},levelSparkle:{mode:`burst`,motion:`emit`,texture:`star`,blending:`additive`,variants:1,lit:0,pulse:1,tumble:0,aspect:1,streak:0,fade:[.05,.3],twinkle:0,blink:0,nightVisibility:0,count:14,life:[.6,1.1],size:[.14,.26],sizeEnd:.8,spawnSize:[1.3,.5,1.3],velocity:[0,.9,0],burstSpeed:[.3,.8],burstUp:[.1,.5],gravity:.2,drag:1.5,spin:[.5,2],color:`#fff0c8`,hdr:1.15,alpha:1}},Qi={mode:`point`,motion:`emit`,texture:`glow`,blending:`additive`,count:32,life:[1,2],size:[.1,.1],sizeEnd:1,aspect:1,streak:0,velocity:[0,0,0],velocityVariance:[0,0,0],radial:0,gravity:0,drag:0,windInfluence:0,turbulence:[0,1],spin:[0,0],tumble:0,color:`#ffffff`,colorEnd:null,colors:null,hdr:1,alpha:1,fade:[.1,.3],twinkle:0,blink:0,nightVisibility:0,lit:0,pulse:0,bounds:[6,3,6],spawnSize:[.2,.2,.2],followCamera:!1,followDistance:20,burstSpeed:[.5,1.5],burstUp:[.5,1.5],ballistic:!1,map:null,variants:1},$i=`
float lpBayer4( vec2 p ) {
	ivec2 q = ivec2( mod( floor( p ), 4.0 ) );
	const float M[ 16 ] = float[ 16 ]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );
	return ( M[ q.y * 4 + q.x ] + 0.5 ) / 16.0;
}
`,ea=`
#include <common>
#include <fog_pars_vertex>

uniform float uTime;
uniform float uNight;
uniform vec2 uWind;
uniform float uWindStrength;
uniform vec3 uSunColor;

uniform vec3 uOrigin;
uniform vec3 uBox;
uniform float uSeed;
uniform float uCount;
uniform float uIntensity;
uniform vec2 uLife;
uniform vec2 uSize;
uniform float uSizeEnd;
uniform vec2 uStretch;
uniform vec3 uVel;
uniform vec3 uVelVar;
uniform float uRadial;
uniform float uGravity;
uniform float uDrag;
uniform float uWindInfluence;
uniform vec2 uTurb;
uniform vec2 uSpin;
uniform float uTumble;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uPalette[ 4 ];
uniform float uPaletteSize;
uniform float uAlpha;
uniform vec2 uFade;
uniform float uVariants;
uniform float uTwinkle;
uniform float uBlink;
uniform float uNightVis;
uniform float uLit;
uniform float uPulse;

#ifdef BURST
attribute vec4 aOrigin; // xyz spawn, w birth time
attribute vec4 aVel;    // xyz initial velocity, w life
attribute vec4 aSize;   // x size, y end multiplier, z rotation, w spin
attribute vec4 aColor;  // rgb (linear, HDR), a alpha
attribute vec4 aPhys;   // x gravity, y drag, z wind influence, w seed
#endif

varying vec2 vUv;
varying vec4 vColor;
varying float vVariant;

uvec4 lpPcg4( uvec4 v ) {
	v = v * 1664525u + 1013904223u;
	v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
	v ^= v >> 16u;
	v.x += v.y * v.w; v.y += v.z * v.x; v.z += v.x * v.y; v.w += v.y * v.z;
	return v;
}

vec4 lpHash( float a, float b, float c ) {
	uvec4 h = lpPcg4( uvec4( uint( a ), uint( b ), uint( c ), 2654435769u ) );
	return vec4( h >> 8u ) / 16777216.0;
}

void main() {

	vec3 wind3 = vec3( uWind.x, 0.0, uWind.y ) * uWindStrength;
	vec3 wpos = vec3( 0.0 );
	vec3 vel = vec3( 0.0, - 1.0, 0.0 );
	float t = 0.5;
	float age = 0.0;
	float size = 0.1;
	float angle = 0.0;
	float tumble = 1.0;
	float gate = 1.0;
	vec3 col = uColor0;
	float alpha = uAlpha;
	vec4 s = vec4( 0.5 );

#ifdef BURST

	age = uTime - aOrigin.w;
	float life = max( aVel.w, 1e-3 );
	t = age / life;
	gate = ( age >= 0.0 && t < 1.0 ) ? 1.0 : 0.0;
	s = fract( vec4( aPhys.w, aPhys.w * 7.31, aPhys.w * 13.17, aPhys.w * 3.73 ) );
	float k = max( aPhys.y, 1e-3 );
	vec3 g = vec3( 0.0, aPhys.x, 0.0 ) + wind3 * aPhys.z;
	float ek = exp( - k * max( age, 0.0 ) );
	float E = ( 1.0 - ek ) / k;
	wpos = aOrigin.xyz + aVel.xyz * E + g / k * ( age - E );
	vel = aVel.xyz * ek + g / k * ( 1.0 - ek );
	size = aSize.x * mix( 1.0, aSize.y, clamp( t, 0.0, 1.0 ) );
	angle = aSize.z + aSize.w * age;
	col = aColor.rgb;
	alpha = aColor.a;
	tumble = mix( 1.0, cos( age * aSize.w * 1.3 + s.y * 6.2831 ), uTumble );

#else

	float id = float( gl_InstanceID );
	s = lpHash( id, 0.0, uSeed );
	gate = clamp( uIntensity * uCount - id, 0.0, 1.0 ) * clamp( uIntensity * 3.0, 0.0, 1.0 );

	#ifdef MOTION_PRECIP

		vec4 r = lpHash( id, 1.0, uSeed );
		vec3 box = max( uBox, vec3( 1e-3 ) );
		float speed = abs( uVel.y ) * mix( 1.0 - uVelVar.y, 1.0 + uVelVar.y, r.w );
		vel = vec3( uVel.x, - speed, uVel.z ) + wind3 * uWindInfluence;
		vec3 p = r.xyz * box + vel * uTime;
		p.x += sin( uTime * uTurb.y + r.x * 43.0 ) * uTurb.x;
		p.z += cos( uTime * uTurb.y * 0.83 + r.z * 37.0 ) * uTurb.x;
		vec3 bmin = uOrigin - box * 0.5;
		vec3 rel = mod( p - bmin, box );
		wpos = bmin + rel;
		vec3 rn = rel / box;
		alpha *= smoothstep( 0.0, 0.05, rn.y ) * ( 1.0 - smoothstep( 0.8, 1.0, rn.y ) )
			* smoothstep( 0.0, 0.12, rn.x ) * ( 1.0 - smoothstep( 0.88, 1.0, rn.x ) )
			* smoothstep( 0.0, 0.12, rn.z ) * ( 1.0 - smoothstep( 0.88, 1.0, rn.z ) );
		size = mix( uSize.x, uSize.y, s.y );
		angle = s.w * 6.2831 + uSpin.x * uTime * ( s.x < 0.5 ? - 1.0 : 1.0 );
		age = uTime;
		t = 0.5;

	#else

		float life = max( mix( uLife.x, uLife.y, s.y ), 0.05 );
		#ifdef MOTION_FALL
			float fallSpeed = max( abs( uVel.y ) * mix( 1.0 - uVelVar.y, 1.0 + uVelVar.y, s.y ), 0.05 );
			life = max( uBox.y / fallSpeed, 0.05 );
		#endif
		float tt = uTime + s.z * life;
		float cycle = floor( tt / life );
		age = tt - cycle * life;
		t = age / life;
		vec4 r = lpHash( id, cycle + 2.0, uSeed + 17.0 );
		vec4 r2 = lpHash( id, cycle + 2.0, uSeed + 91.0 );
		vec3 spawn = uOrigin + ( r.xyz - 0.5 ) * uBox;

		#if defined( MOTION_DRIFT )

			float f = uTurb.y;
			vec3 wob = vec3(
				sin( uTime * f * ( 0.7 + r.w * 0.6 ) + r.x * 6.2831 ),
				sin( uTime * f * ( 0.5 + r2.x * 0.5 ) + r.y * 6.2831 ) * 0.5,
				cos( uTime * f * ( 0.6 + r2.y * 0.5 ) + r.z * 6.2831 ) ) * uTurb.x;
			vel = uVel + ( r2.xyz - 0.5 ) * 2.0 * uVelVar + wind3 * uWindInfluence;
			wpos = spawn + vel * age + wob;

		#elif defined( MOTION_FALL )

			spawn.y = uOrigin.y + uBox.y * 0.5;
			float sf = uTurb.y * ( 0.7 + 0.6 * r.w );
			wpos = spawn + vec3( 0.0, - fallSpeed * age, 0.0 ) + wind3 * uWindInfluence * age
				+ vec3( sin( age * sf + r.x * 6.2831 ), 0.0, cos( age * sf * 0.7 + r.z * 6.2831 ) * 0.6 ) * uTurb.x;
			vel = vec3( 0.0, - fallSpeed, 0.0 );
			tumble = mix( 1.0, cos( age * mix( uSpin.x, uSpin.y, r2.x ) * 1.3 + r2.y * 6.2831 ), uTumble );

		#else

			float ang = r.w * 6.2831;
			vec3 v0 = uVel + ( r2.xyz - 0.5 ) * 2.0 * uVelVar + vec3( cos( ang ), 0.0, sin( ang ) ) * uRadial * ( 0.4 + 0.6 * r2.w );
			float k = max( uDrag, 1e-3 );
			vec3 g = vec3( 0.0, uGravity, 0.0 ) + wind3 * uWindInfluence;
			float ek = exp( - k * age );
			float E = ( 1.0 - ek ) / k;
			wpos = spawn + v0 * E + g / k * ( age - E );
			vel = v0 * ek + g / k * ( 1.0 - ek );
			wpos += vec3( sin( age * uTurb.y + r.x * 6.2831 ), 0.0, cos( age * uTurb.y * 1.3 + r.y * 6.2831 ) ) * uTurb.x * t;
			tumble = mix( 1.0, cos( age * uSpin.y * 1.3 + r2.y * 6.2831 ), uTumble );

		#endif

		size = mix( uSize.x, uSize.y, r2.z ) * mix( 1.0, uSizeEnd, t );
		angle = r2.w * 6.2831 + mix( uSpin.x, uSpin.y, r.w ) * age * ( r2.x < 0.5 ? - 1.0 : 1.0 );
		col = mix( uColor0, uColor1, t );
		if ( uPaletteSize > 0.5 ) {
			int pIdx = int( min( floor( r2.z * uPaletteSize ), uPaletteSize - 1.0 ) );
			col = uPalette[ pIdx ];
		}
		s = r;

	#endif

#endif

	// life envelope
	float fadeIn = smoothstep( 0.0, max( uFade.x, 1e-4 ), t );
	float fadeOut = 1.0 - smoothstep( 1.0 - max( uFade.y, 1e-4 ), 1.0, t );
	alpha *= fadeIn * fadeOut;
	size *= mix( 1.0, sin( PI * clamp( t, 0.0, 1.0 ) ), uPulse );

	if ( uTwinkle > 0.0 ) {
		// max(): GPU sin() may overshoot -1 slightly; pow() of a negative base is NaN, and a NaN in the
		// HDR target spreads through bloom as black/white blocks
		float tw = pow( max( 0.5 + 0.5 * sin( uTime * ( 1.1 + s.x * 2.3 ) + s.z * 6.2831 ), 0.0 ), 14.0 );
		col *= 1.0 + uTwinkle * tw * 3.0;
		size *= 1.0 + uTwinkle * tw * 0.5;
	}
	if ( uBlink > 0.0 ) {
		float bl = smoothstep( 0.1, 0.95, sin( uTime * ( 0.8 + s.y * 1.3 ) + s.w * 6.2831 ) );
		alpha *= mix( 1.0, bl, uBlink );
		size *= mix( 1.0, 0.55 + 0.45 * bl, uBlink );
	}
	if ( uNightVis > 0.0 ) alpha *= smoothstep( 0.3, 0.85, uNight ) * uNightVis;
	else if ( uNightVis < 0.0 ) alpha *= 1.0 - uNight * ( - uNightVis );
	if ( uLit > 0.0 ) {
		vec3 amb = mix( vec3( 0.42, 0.45, 0.52 ), vec3( 0.06, 0.08, 0.15 ), uNight );
		col *= mix( vec3( 1.0 ), amb + uSunColor * 0.75, uLit );
	}
	if ( tumble < 0.0 ) col *= 0.78; // back side of a tumbling leaf
	alpha *= gate;

	vec4 mv = viewMatrix * vec4( wpos, 1.0 );
	vec2 corner = position.xy;
	vUv = uv;

#ifdef STREAK
	vec3 vv = ( viewMatrix * vec4( vel, 0.0 ) ).xyz;
	float vl = length( vv.xy );
	vec2 dir = vl > 1e-4 ? vv.xy / vl : vec2( 0.0, - 1.0 );
	vec2 side = vec2( - dir.y, dir.x );
	float len = size * uStretch.x + vl * uStretch.y;
	mv.xy += side * corner.x * size + dir * corner.y * len;
#else
	float tf = ( tumble >= 0.0 ? 1.0 : - 1.0 ) * max( abs( tumble ), 0.18 );
	corner.x *= tf;
	corner.y *= uStretch.x;
	float ca = cos( angle );
	float sa = sin( angle );
	mv.xy += vec2( corner.x * ca - corner.y * sa, corner.x * sa + corner.y * ca ) * size;
#endif

	gl_Position = projectionMatrix * mv;
	if ( alpha <= 0.002 ) gl_Position = vec4( 0.0, 0.0, 2.0, 1.0 ); // cull dead / hidden particles

	vColor = vec4( col, alpha );
	vVariant = floor( s.x * uVariants );

	#ifdef USE_FOG
		// the standard chunk (vFogDepth = -mvPosition.z), so a game that patches it — e.g. to start
		// the fog some distance in front of the camera — fogs particles like every other material
		vec4 mvPosition = mv;
		#include <fog_vertex>
	#endif
}
`,ta=`
#include <common>
#include <fog_pars_fragment>

uniform sampler2D uMap;
uniform float uVariants;

varying vec2 vUv;
varying vec4 vColor;
varying float vVariant;

${$i}

void main() {

#ifdef USE_PMAP
	vec4 tex = texture2D( uMap, vec2( ( min( vVariant, uVariants - 1.0 ) + vUv.x ) / uVariants, vUv.y ) );
#else
	float across = 1.0 - abs( vUv.x * 2.0 - 1.0 );
	vec4 tex = vec4( 1.0, 1.0, 1.0, smoothstep( 0.0, 1.0, vUv.y ) * smoothstep( 0.0, 0.7, across ) );
#endif

	vec4 outColor = vec4( vColor.rgb * tex.rgb, vColor.a * tex.a );

#ifdef CUTOUT
	if ( tex.a < 0.5 ) discard;
	if ( vColor.a < 0.999 && vColor.a <= lpBayer4( gl_FragCoord.xy ) ) discard;
	outColor.a = 1.0;
#else
	if ( outColor.a < 0.004 ) discard;
#endif

	gl_FragColor = outColor;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

	#ifdef USE_FOG
		#ifdef FOG_EXP2
			float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		#else
			float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		#endif
		#ifdef ADDITIVE
			gl_FragColor.rgb *= 1.0 - fogFactor;
		#else
			gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
		#endif
	#endif
}
`;function na(e,t,n,r,i){for(let a=0;a<r.length;a++){let o=r[a];for(let r=0;r<o.length;r++){let s=i[o[r]];s&&e.set(t+r,n+a,[s[0]*255,s[0]*255,s[0]*255,s[1]*255])}}}function ra(e,t,n,{angle:r,a:i,b:a,midrib:o,shades:s,stem:c}){let l=n/2-.5,u=n/2-.5,d=Math.cos(r),f=Math.sin(r),p=new I(n,n);for(let e=0;e<n;e++)for(let t=0;t<n;t++){let n=t-l,r=e-u,c=n*d+r*f,m=-n*f+r*d,h=a*(1-Math.max(0,c/i)*.35),g=c*c/(i*i)+m*m/(h*h);if(g>1)continue;let _=m<-.35?s.light:s.mid;g>.62&&m>.2&&(_=s.dark),o&&Math.abs(m)<.45&&c>-i*.8&&c<i*.75&&(_=s.rib),p.set(t,e,[_*255,_*255,_*255,255])}if(c){let e=Math.round(l-d*(i+.6)),t=Math.round(u-f*(i+.6));p.set(e,t,[s.outline*255,s.outline*255,s.outline*255,255])}let m=s.outline*255;p.outline([m,m,m,255]),e.blit(p,t,0)}function ia(e){switch(e){case`glow`:{let e=new I(32,32);for(let t=0;t<32;t++)for(let n=0;n<32;n++){let r=Math.hypot(n+.5-16,t+.5-16)/16,i=_(.8*Math.exp(-r*r*4.5)+.2*Math.exp(-r*r*40)-.009*r,0,1);e.set(n,t,[255,255,255,i*255])}let t=ce(e.toCanvas(),{wrap:`clamp`,mipmaps:!0,srgb:!0,name:`particle_glow`});return t.magFilter=te,{texture:t,variants:1}}case`square`:{let e=new I(8,4),t={b:[1,.55],d:[1,1]};return na(e,0,0,[`.bb.`,`bddb`,`bddb`,`.bb.`],t),na(e,4,0,[`....`,`.dd.`,`.dd.`,`....`],t),{texture:ce(e.toCanvas(),{wrap:`clamp`,name:`particle_square`}),variants:2}}case`snow`:{let e=new I(8,4),t={a:[1,.4],b:[1,.8],d:[1,1]};return na(e,0,0,[`.aa.`,`abba`,`abda`,`.aa.`],t),na(e,4,0,[`....`,`.bd.`,`.db.`,`....`],t),{texture:ce(e.toCanvas(),{wrap:`clamp`,name:`particle_snow`}),variants:2}}case`star`:{let e=new I(18,9),t={a:[1,.3],b:[1,.6],c:[1,.85],d:[1,1]};return na(e,0,0,[`....a....`,`....b....`,`....c....`,`...bdb...`,`abcdddcba`,`...bdb...`,`....c....`,`....b....`,`....a....`],t),na(e,9,0,[`.........`,`.........`,`..a...a..`,`...bcb...`,`...cdc...`,`...bcb...`,`..a...a..`,`.........`,`.........`],t),{texture:ce(e.toCanvas(),{wrap:`clamp`,name:`particle_star`}),variants:2}}case`leaf`:{let e=new I(32,8),t={light:1,mid:.8,dark:.62,rib:.66,outline:.3};return ra(e,0,8,{angle:-.75,a:3.1,b:1.55,midrib:!0,shades:t,stem:!0}),ra(e,8,8,{angle:.6,a:2.7,b:1.7,midrib:!0,shades:t,stem:!0}),ra(e,16,8,{angle:-1.35,a:3,b:1.35,midrib:!1,shades:t,stem:!0}),ra(e,24,8,{angle:2.3,a:2.6,b:1.9,midrib:!0,shades:t,stem:!1}),{texture:ce(e.toCanvas(),{wrap:`clamp`,name:`particle_leaf`}),variants:4}}case`petal`:{let e=new I(32,8),t={light:1,mid:.92,dark:.8,rib:.9,outline:.66};return ra(e,0,8,{angle:-.5,a:2.2,b:1.6,midrib:!1,shades:t,stem:!1}),ra(e,8,8,{angle:.9,a:2,b:1.4,midrib:!1,shades:t,stem:!1}),ra(e,16,8,{angle:2,a:2.4,b:1.3,midrib:!1,shades:t,stem:!1}),ra(e,24,8,{angle:-1.8,a:1.8,b:1.5,midrib:!1,shades:t,stem:!1}),{texture:ce(e.toCanvas(),{wrap:`clamp`,name:`particle_petal`}),variants:4}}case`smoke`:{let e=new I(128,32);for(let t=0;t<4;t++){let n=t*32;for(let r=0;r<32;r++)for(let i=0;i<32;i++){let a=(i+.5-16)/16,o=(r+.5-16)/16,s=Le(i/9+t*7.3,r/9+t*3.1,{octaves:3,seed:71+t}),c=Math.hypot(a,o)*1.08+(s-.5)*.55,l=_((.95-c)/.55,0,1);l=l*l*(3-2*l);let u=_(Math.floor(l*5+m(i,r)-.25),0,5)/5;if(u<=0)continue;let d=_(.5-o*.35-a*.15+(s-.5)*.5,0,1),f=.74+Math.round(d*3)/3*.26;e.set(n+i,r,[f*255,f*255,Math.min(1,f*1.03)*255,u*255])}}return{texture:ce(e.toCanvas(),{wrap:`clamp`,mipmaps:!0,name:`particle_smoke`}),variants:4}}default:return null}}function aa(e,t){return e==null?t:Array.isArray(e)?[e[0],e.length>1?e[1]:e[0]]:[e,e]}function oa(e,t){return e==null?new l().fromArray(t):e.isVector3?e.clone():Array.isArray(e)?new l(e[0],e[1],e[2]):new l(e,e,e)}function sa(e,t=1,n=new F){return n.set(x(e,F.NAMES)).multiplyScalar(t)}var ca=(e,t)=>t[0]+(t[1]-t[0])*e.next();function la(e,t){let n=xe(Zi,e);if(!n)throw Error(`Particles: unknown preset "${e}"`);let r={...Qi,...n,...t,preset:e};return Array.isArray(t.color)&&t.color.length===2&&typeof t.color[0]!=`number`?(r.color=t.color[0],r.colorEnd=t.color[1]):t.color!=null&&t.colorEnd===void 0&&(r.colorEnd=null,t.colors===void 0&&(r.colors=null)),r.size=aa(r.size,[.1,.1]),r.life=aa(r.life,[1,2]),r.spin=aa(r.spin,[0,0]),r.fade=aa(r.fade,[.1,.3]),r.turbulence=aa(r.turbulence,[0,1]),r.burstSpeed=aa(r.burstSpeed,[.5,1.5]),r.burstUp=aa(r.burstUp,[.5,1.5]),r}function ua(e,t){let n=[new F,new F,new F,new F],r=0;if(Array.isArray(e.colors)&&e.colors.length){r=Math.min(4,e.colors.length);for(let t=0;t<4;t++)sa(e.colors[Math.min(t,r-1)],e.hdr,n[t])}let i=sa(e.color,e.hdr),a=e.colorEnd==null?i.clone():sa(e.colorEnd,e.hdr);return{uTime:R.uTime,uNight:R.uNight,uWind:R.uWind,uWindStrength:R.uWindStrength,uSunColor:R.uSunColor,...j.clone(Ve.fog),uFogStart:R.uFogStart,uMap:{value:t?t.texture:null},uVariants:{value:t?t.variants:1},uOrigin:{value:new l},uBox:{value:new l(1,1,1)},uSeed:{value:1},uCount:{value:1},uIntensity:{value:1},uLife:{value:new C(e.life[0],e.life[1])},uSize:{value:new C(e.size[0],e.size[1])},uSizeEnd:{value:e.sizeEnd},uStretch:{value:new C(e.aspect,e.streak)},uVel:{value:oa(e.velocity,[0,0,0])},uVelVar:{value:oa(e.velocityVariance,[0,0,0])},uRadial:{value:e.radial},uGravity:{value:e.gravity},uDrag:{value:e.drag},uWindInfluence:{value:e.windInfluence},uTurb:{value:new C(e.turbulence[0],e.turbulence[1])},uSpin:{value:new C(e.spin[0],e.spin[1])},uTumble:{value:e.tumble},uColor0:{value:i},uColor1:{value:a},uPalette:{value:n},uPaletteSize:{value:r},uAlpha:{value:e.alpha},uFade:{value:new C(e.fade[0],e.fade[1])},uTwinkle:{value:e.twinkle},uBlink:{value:e.blink},uNightVis:{value:e.nightVisibility},uLit:{value:typeof e.lit==`boolean`?+!!e.lit:e.lit},uPulse:{value:e.pulse}}}function da(e,t,n){let r={};r[`MOTION_${String(n?`emit`:e.motion).toUpperCase()}`]=``,n&&(r.BURST=``),e.texture===`streak`&&!e.map?r.STREAK=``:r.USE_PMAP=``,e.blending===`additive`&&(r.ADDITIVE=``),e.blending===`cutout`&&(r.CUTOUT=``);let i=e.blending===`cutout`;return new me({name:`Particles.${e.preset}${n?`.burst`:``}`,uniforms:t,defines:r,vertexShader:ea,fragmentShader:ta,transparent:!i,depthWrite:i,blending:e.blending===`additive`?2:1,side:2,fog:!0})}function fa(){let e=new y,t=new ue(1,1);return e.setIndex(t.index),e.setAttribute(`position`,t.getAttribute(`position`)),e.setAttribute(`uv`,t.getAttribute(`uv`)),t.dispose(),e}var pa=class{constructor(e,t){let n=la(t.preset,t);this.system=e,this.config=n,this.preset=n.preset,this.followCamera=!!n.followCamera,this.followDistance=n.followDistance;let r=!!t.bounds||n.mode===`area`||n.motion===`precip`;this.mode=r?`area`:`point`;let i=t.bounds?.center??t.position??new l;this.position=i.isVector3?i.clone():Array.isArray(i)?new l().fromArray(i):new l(i.x??0,i.y??0,i.z??0);let a=r?t.bounds?.size??n.bounds:n.spawnSize;this.boxSize=oa(a,[1,1,1]);let o=!!t.bounds?.center,s=this.position.y;r&&!o&&t.position&&n.motion!==`precip`&&(this.position.y+=this.boxSize.y*.5),this.followBaseY=o?s-this.boxSize.y*.5:t.position?s:0;let c=n.count;t.rate!=null&&n.motion!==`precip`&&(c=Math.ceil(t.rate*(n.life[0]+n.life[1])*.5)),this.count=Math.max(1,Math.round(c));let u=null;n.map?u={texture:n.map,variants:n.variants||1}:n.texture!==`streak`&&(u=e._texture(n.texture)),this.uniforms=ua(n,u),this.uniforms.uOrigin.value=this.position,this.uniforms.uBox.value.copy(this.boxSize),this.uniforms.uSeed.value=t.seed??e._nextSeed(n.preset),this.uniforms.uCount.value=this.count,this.geometry=fa(),this.geometry.instanceCount=this.count,this.material=da(n,this.uniforms,!1),this.object=new E(this.geometry,this.material),this.object.name=`Emitter.${n.preset}`,this.object.renderOrder=h.PARTICLES+(n.blending===`additive`?2:0),this.object.matrixAutoUpdate=!1,this.object.castShadow=!1,this.object.receiveShadow=!1,this.object.frustumCulled=!this.followCamera,this._windKey=this._windStrength(),this.geometry.boundingSphere=new se(this.position.clone(),this._estimateRadius()),this.geometry.boundingBox=null,this._enabled=!0,this._intensity=1,this.enabled=t.enabled??!0,this.intensity=t.intensity??1}_windStrength(){return R.uWind.value.length()*Math.max(1,R.uWindStrength.value)}_estimateRadius(){let e=this.config,t=e.life[1],n=this.uniforms,r=n.uVel.value.length()+n.uVelVar.value.length()+e.radial,i=Math.max(e.drag,.001),a=R.uWind.value.length()*Math.max(1,R.uWindStrength.value)*e.windInfluence,o=Math.abs(e.gravity)+a,s=Math.min(r*t,r/i)+Math.min(.5*o*t*t,o/i*t);this.config.motion===`fall`&&(s=a*(this.boxSize.y/Math.max(.05,Math.abs(n.uVel.value.y)))+e.turbulence[0]),this.config.motion===`drift`&&(s=(r+a)*t+e.turbulence[0]);let c=e.size[1]*Math.max(1,e.sizeEnd)*Math.max(1,e.aspect);return this.boxSize.length()*.5+s+c+.5}get enabled(){return this._enabled}set enabled(e){this._enabled=!!e,this._refresh()}get intensity(){return this._intensity}set intensity(e){this._intensity=Math.max(0,+e||0),this.uniforms.uIntensity.value=this._intensity,this._refresh()}_refresh(){let e=Math.min(this.count,Math.ceil(this.count*Math.min(1,this._intensity)));this.geometry.instanceCount=e,this.object.visible=this._enabled&&e>0}_update(e,t){if(this.followCamera&&e){let e=this.followBaseY,n=this.followDistance;t.fy<-.05&&(n=_((e-t.py)/t.fy,2,120)),this.position.set(t.px+t.fx*n,e+this.boxSize.y*.5,t.pz+t.fz*n)}let n=this.geometry.boundingSphere;if(n.center.copy(this.position),this.object.frustumCulled){let e=this._windStrength();Math.abs(e-this._windKey)>.02*Math.max(1,this._windKey)&&(this._windKey=e,n.radius=this._estimateRadius())}}dispose(){this.object.parent&&this.object.parent.remove(this.object),this.geometry.dispose(),this.material.dispose();let e=this.system.emitters,t=e.indexOf(this);t>=0&&e.splice(t,1)}},ma=class{constructor(e,t,n=512){this.capacity=n,this.head=0,this.used=0,this.aliveUntil=-1/0;let r=null;t.map?r={texture:t.map,variants:t.variants||1}:t.texture!==`streak`&&(r=e._texture(t.texture)),this.uniforms=ua(t,r);let i=fa(),a=()=>{let e=new be(new Float32Array(n*4),4);return e.setUsage(je),e};this.aOrigin=a(),this.aVel=a(),this.aSize=a(),this.aColor=a(),this.aPhys=a();for(let e=0;e<n;e++)this.aOrigin.array[e*4+3]=-1e6;i.setAttribute(`aOrigin`,this.aOrigin),i.setAttribute(`aVel`,this.aVel),i.setAttribute(`aSize`,this.aSize),i.setAttribute(`aColor`,this.aColor),i.setAttribute(`aPhys`,this.aPhys),i.instanceCount=0,this.geometry=i,this.material=da(t,this.uniforms,!0),this.object=new E(i,this.material),this.object.name=`Particles.burst.${t.texture}.${t.blending}`,this.object.frustumCulled=!1,this.object.matrixAutoUpdate=!1,this.object.renderOrder=h.PARTICLES+(t.blending===`additive`?3:1),this.object.visible=!1,this._dirtyStart=1/0,this._dirtyEnd=-1}write(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y){let b=this.head,x=b*4,S=this.aOrigin.array;S[x]=e,S[x+1]=t,S[x+2]=n,S[x+3]=r,S=this.aVel.array,S[x]=i,S[x+1]=a,S[x+2]=o,S[x+3]=s,S=this.aSize.array,S[x]=c,S[x+1]=l,S[x+2]=u,S[x+3]=d,S=this.aColor.array,S[x]=f,S[x+1]=p,S[x+2]=m,S[x+3]=h,S=this.aPhys.array,S[x]=g,S[x+1]=_,S[x+2]=v,S[x+3]=y,b<this._dirtyStart&&(this._dirtyStart=b),b+1>this._dirtyEnd&&(this._dirtyEnd=b+1),this.head=(b+1)%this.capacity,this.used=Math.max(this.used,b+1),r+s>this.aliveUntil&&(this.aliveUntil=r+s)}flush(){if(this._dirtyEnd<0)return;let e=this._dirtyStart*4,t=(this._dirtyEnd-this._dirtyStart)*4;for(let n of[this.aOrigin,this.aVel,this.aSize,this.aColor,this.aPhys])n.addUpdateRange(e,t),n.needsUpdate=!0;this._dirtyStart=1/0,this._dirtyEnd=-1,this.geometry.instanceCount=this.used,this.object.visible=!0}dispose(){this.object.parent&&this.object.parent.remove(this.object),this.geometry.dispose(),this.material.dispose()}},ha=class{constructor(e){this.scene=e,this.object=new s,this.object.name=`Particles`,e&&e.add(this.object),this.emitters=[],this._pools=new Map,this._poolList=[],this._burstConfigs=new Map,this._textures=new Map,this._rng=new u(20903),this._emitterCounter=0,this._cam={px:0,py:0,pz:0,fx:0,fy:-1,fz:0}}_texture(e){let t=this._textures.get(e);return t===void 0&&(t=ia(e),this._textures.set(e,t)),t}_nextSeed(e){return this._emitterCounter++,(ne(e)+this._emitterCounter*7919)%1000003}createEmitter(e){let t=new pa(this,e);return this.emitters.push(t),this.object.add(t.object),t}_pool(e){let t=`${e.map?e.map.uuid:e.texture}|${e.variants}|${e.blending}|${+e.lit}|${e.pulse}|${e.tumble}|${e.aspect}|${e.streak}|${e.fade[0]}|${e.fade[1]}|${e.twinkle}|${e.blink}|${e.nightVisibility}`,n=this._pools.get(t);return n||(n=new ma(this,e),this._pools.set(t,n),this._poolList.push(n),this.object.add(n.object)),n}_burstConfig(e,t){let n=!1;for(let e in t){n=!0;break}if(!n){let t=this._burstConfigs.get(e);if(t)return t}let r=la(e,t);return r._spawn=oa(r.spawnSize,[.2,.2,.2]),r._vel=oa(r.velocity,[0,0,0]),r._velVar=oa(r.velocityVariance,[0,0,0]),r._color=sa(r.color,r.hdr),r._palette=Array.isArray(r.colors)&&r.colors.length?r.colors.map(e=>sa(e,r.hdr)):null,r._lit=typeof r.lit==`boolean`?+!!r.lit:r.lit,r._pool=this._pool(r),n||this._burstConfigs.set(e,r),r}burst(e,t,n=12,r={}){let i=this._burstConfig(e,r),a=i._pool,o=this._rng,s=R.uTime.value,c=i._vel,l=i._velVar,u=i._spawn,d=i._palette,f=i._color,p=Math.max(0,Math.min(a.capacity,n|0));for(let e=0;e<p;e++){let e=o.next()*Math.PI*2,n=ca(o,i.burstSpeed),r=ca(o,i.burstUp),p=Math.cos(e)*n+c.x+(o.next()*2-1)*l.x,m=r+c.y+(o.next()*2-1)*l.y,h=Math.sin(e)*n+c.z+(o.next()*2-1)*l.z,g=ca(o,i.life);i.ballistic&&i.gravity<0&&m>0&&(g=Math.min(g,2*m/-i.gravity*.95));let _=d?d[Math.floor(o.next()*d.length)]:f,v=ca(o,i.spin)*(o.next()<.5?-1:1);a.write(t.x+(o.next()-.5)*u.x,t.y+(o.next()-.5)*u.y,t.z+(o.next()-.5)*u.z,s,p,m,h,g,ca(o,i.size),i.sizeEnd,o.next()*Math.PI*2,v,_.r,_.g,_.b,i.alpha,i.gravity,i.drag,i.windInfluence,o.next())}a.flush()}burstPools(){return this._poolList.slice()}releaseBurstPools(e){let t=new Set(e);if(t.size){for(let[e,n]of this._pools)t.has(n)&&this._pools.delete(e);for(let[e,n]of this._burstConfigs)t.has(n._pool)&&this._burstConfigs.delete(e);for(let e=this._poolList.length-1;e>=0;e--)t.has(this._poolList[e])&&this._poolList.splice(e,1);for(let e of t)e.dispose()}}update(e,t){let n=this._cam;if(t){let e=t.matrixWorld.elements;n.px=e[12],n.py=e[13],n.pz=e[14],n.fx=-e[8],n.fy=-e[9],n.fz=-e[10]}for(let e=0;e<this.emitters.length;e++)this.emitters[e]._update(t,n);let r=R.uTime.value,i=this._poolList;for(let e=0;e<i.length;e++){let t=i[e];t.object.visible&&r>t.aliveUntil+.05&&(t.object.visible=!1)}}dispose(){for(let e of this.emitters.slice())e.dispose();this.emitters.length=0;for(let e of this._poolList)e.dispose();this._pools.clear(),this._poolList.length=0,this._burstConfigs.clear();for(let e of this._textures.values())e&&e.texture.dispose();this._textures.clear(),this.object.parent&&this.object.parent.remove(this.object)}},ga=`
uniform vec3 uSunDirection;
uniform float uSteepness;
uniform float uUseSun;
uniform vec3 uAxis;
uniform float uLength;
uniform float uWidth;
uniform float uTopWidth;

varying vec2 vUv;
varying vec3 vWorld;
varying float vAxisView;

#include <fog_pars_vertex>

void main() {
  vec3 toLight;
  if (uUseSun > 0.5) {
    vec3 s = normalize(uSunDirection);
    float hl = length(s.xz);
    vec2 hd = hl > 1e-4 ? s.xz / hl : vec2(0.0, 1.0);
    float el = asin(clamp(s.y, -1.0, 1.0));
    el = max(el, 0.12);
    el = mix(el, 1.5707963, uSteepness);
    toLight = vec3(hd.x * cos(el), sin(el), hd.y * cos(el));
  } else {
    toLight = -normalize(uAxis);
  }

  vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float u = position.x;           // -0.5 .. 0.5 across
  float v = position.y;           // 0 (ground) .. 1 (top)
  vec3 c = base + toLight * (v * uLength);
  vec3 view = normalize(cameraPosition - c);
  vec3 side = cross(toLight, view);
  float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
  float w = uWidth * mix(1.0, uTopWidth, v);
  vec3 wp = c + side * (u * w);

  vUv = vec2(u * 2.0, v);
  vWorld = wp;
  vAxisView = abs(dot(view, toLight));

  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,_a=`
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform vec3 uColor;
uniform float uNight;
uniform float uTime;
uniform float uIntensity;
uniform float uGlobalIntensity;
uniform float uNightStrength;
uniform float uSeed;
uniform float uGroundY;
uniform float uFadeHeight;
uniform float uLength;
uniform vec2 uNearFade;
uniform vec2 uHorizonFade;
uniform float uGain;

varying vec2 vUv;
varying vec3 vWorld;
varying float vAxisView;

#include <fog_pars_fragment>

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float x = vUv.x;                       // -1 .. 1 across
  float v = vUv.y;                       // 0 bottom .. 1 top
  float across = exp(-x * x * 3.2) - 0.04;
  across = max(across, 0.0) / 0.96;

  float topFade = 1.0 - smoothstep(0.5, 1.0, v);
  float groundFade = smoothstep(uGroundY - 0.2, uGroundY + uFadeHeight, vWorld.y);
  float mid = mix(0.75, 1.0, smoothstep(0.1, 0.55, v));

  // Streaks parallel to the beam, drifting slowly.
  float along = v * uLength;
  float s1 = vnoise(vec2(x * 2.6 + uSeed * 7.1 + uTime * 0.05, along * 0.09 - uTime * 0.12));
  float s2 = vnoise(vec2(x * 6.3 - uSeed * 3.7 - uTime * 0.08, along * 0.16 - uTime * 0.21));
  float streak = 0.3 + 0.7 * smoothstep(0.15, 0.85, s1 * 0.62 + s2 * 0.38);
  // Slow breathing so the scene feels alive.
  float breathe = 0.82 + 0.18 * sin(uTime * 0.35 + uSeed * 6.2831);

  float axisFade = 1.0 - smoothstep(0.82, 0.98, vAxisView);
  float camDist = distance(cameraPosition, vWorld);
  float nearFade = smoothstep(uNearFade.x, uNearFade.y, camDist);

  float sunY = normalize(uSunDirection).y;
  // Strongest with a low sun (golden hour / morning), weaker at noon, gone as the sun sets.
  float lowSun = mix(0.4, 1.0, 1.0 - smoothstep(0.3, 0.8, sunY)) * smoothstep(uHorizonFade.x, uHorizonFade.y, sunY);
  float dayMix = mix(uNightStrength, 1.0, 1.0 - uNight);

  float a = across * topFade * groundFade * mid * streak * breathe * axisFade * nearFade
          * lowSun * dayMix * uIntensity * uGlobalIntensity;

  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogF = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    a *= 1.0 - fogF;
  #endif

  // Slightly desaturated sun colour: beams read as pale warm light, not orange paint.
  vec3 sunCol = mix(vec3(dot(uSunColor, vec3(0.3, 0.59, 0.11))), uSunColor, 0.72);
  vec3 col = sunCol * uColor * (a * uGain);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,va=null,ya=0;function ba(){return va||(va=new ue(1,1,1,6),va.translate(0,.5,0),va.name=`GodRayShaft`),ya++,va}function xa(){ya--,ya<=0&&va&&(va.dispose(),va=null,ya=0)}var Sa=class{constructor({steepness:e=.45,color:t=16773592,nightStrength:n=0,nearFade:r=[5,13],fadeHeight:i=2.2,gain:a=.28,horizonFade:o=[.19,.27]}={}){this.object=new s,this.object.name=`GodRays`,this.shafts=[],this.fadeHeight=i,this._shared={uTime:{value:0},uGlobalIntensity:{value:1},uSteepness:{value:e},uNightStrength:{value:n},uNearFade:{value:new C(r[0],r[1])},uGain:{value:a},uHorizonFade:{value:new C(o[0],o[1])},uTint:new F(t),fog:j.clone(Ve.fog)}}get intensity(){return this._shared.uGlobalIntensity.value}set intensity(e){this._shared.uGlobalIntensity.value=e}get steepness(){return this._shared.uSteepness.value}set steepness(e){this._shared.uSteepness.value=e}addShaft({position:e,direction:t,length:n=14,width:r=3,intensity:i=1,color:a,topWidth:o=.7,seed:s}={}){let c=this._shared,u={uSunDirection:R.uSunDirection,uSunColor:R.uSunColor,uNight:R.uNight,uTime:c.uTime,uGlobalIntensity:c.uGlobalIntensity,uSteepness:c.uSteepness,uNightStrength:c.uNightStrength,uNearFade:c.uNearFade,uGain:c.uGain,uHorizonFade:c.uHorizonFade,fogColor:c.fog.fogColor,fogDensity:c.fog.fogDensity,fogNear:c.fog.fogNear,fogFar:c.fog.fogFar,uFogStart:R.uFogStart,uUseSun:{value:+!t},uAxis:{value:t?new l().copy(t).normalize():new l(0,-1,0)},uLength:{value:n},uWidth:{value:r},uTopWidth:{value:o},uIntensity:{value:i},uColor:{value:a===void 0?c.uTint.clone():new F(a)},uSeed:{value:s??this.shafts.length*.618+.13},uGroundY:{value:e?e.y:0},uFadeHeight:{value:this.fadeHeight}},d=new me({name:`GodRayMaterial`,uniforms:u,vertexShader:ga,fragmentShader:_a,transparent:!0,depthWrite:!1,depthTest:!0,blending:2,side:2,fog:!0});d.forceSinglePass=!0,d.blendEquation=100,d.blendSrc=201,d.blendDst=203;let f=new E(ba(),d);f.name=`GodRayShaft`;let p=new se;f.frustumCulled=!0,f.intersectsFrustum=function(e){return p.center.setFromMatrixPosition(this.matrixWorld),p.radius=u.uLength.value+u.uWidth.value*.5+.1,typeof e.intersectsSphere!=`function`||e.intersectsSphere(p)},f.renderOrder=h.GODRAYS,f.castShadow=!1,f.receiveShadow=!1,f.onBeforeRender=e=>{d.blending=e.getRenderTarget()===null?5:2},e&&f.position.set(e.x,e.y,e.z),this.object.add(f);let m=this.shafts,g=!1,_={mesh:f,get intensity(){return u.uIntensity.value},set intensity(e){u.uIntensity.value=e},dispose(){if(g)return;g=!0;let e=m.indexOf(_);e>=0&&m.splice(e,1),f.removeFromParent(),d.dispose(),xa()}};return m.push(_),_}populate(e,t,n=7){let r=new u(n),i=e.maxX-e.minX,a=e.maxZ-e.minZ,o=Math.max(1,Math.round(Math.sqrt(t*i/Math.max(a,.001)))),s=Math.max(1,Math.ceil(t/o)),c=[];for(let e=0;e<s;e++)for(let t=0;t<o;t++)c.push([t,e]);r.shuffle(c);let d=[];for(let n=0;n<t;n++){let[t,u]=c[n%c.length],f=e.minX+(t+r.range(.15,.85))/o*i,p=e.minZ+(u+r.range(.15,.85))/s*a;d.push(this.addShaft({position:new l(f,e.y??0,p),length:r.range(11,17),width:r.range(1.4,3.4),intensity:r.range(.55,1),topWidth:r.range(.55,.85),seed:r.range(0,10)}))}return d}update(e){this._shared.uTime.value+=e}dispose(){for(let e of[...this.shafts])e.dispose();this.object.removeFromParent()}},Ca=`
varying vec3 vDir;

void main() {
  vDir = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  // Pin the dome to (just inside) the far plane whatever the camera far plane is: it never clips and,
  // with the depth test on, it only fills pixels no opaque geometry has covered.
  #ifdef USE_REVERSED_DEPTH_BUFFER
    gl_Position.z = gl_Position.w * 1e-5;
  #else
    gl_Position.z = gl_Position.w * 0.99999;
  #endif
}
`,wa=`
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uGlow;
uniform float uClouds;
uniform float uLowerClouds;
uniform float uTime;
uniform float uStarDensity;
uniform float uSunSize;
uniform float uMoonSize;
uniform float uSunIntensity;
uniform float uCloudPixel;
uniform vec2 uWind;

varying vec3 vDir;

#define TAU 6.28318530718

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm4(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.13, 3.71);
    a *= 0.5;
  }
  return s / 0.9375;
}

vec3 skyGradient(float y) {
  if (y >= 0.0) {
    float t = smoothstep(0.0, 1.0, pow(clamp(y, 0.0, 1.0), 0.5));
    return mix(uHorizon, uTop, t);
  }
  // Below the horizon: a thick band of horizon haze that slowly sinks into the bottom colour.
  float t = clamp(-y / 0.9, 0.0, 1.0);
  return mix(uHorizon, uBottom, smoothstep(0.0, 1.0, pow(t, 0.8)));
}

// Tangent-plane coordinates of direction d around centre c, in units of radius r.
vec2 discCoord(vec3 d, vec3 c, float r) {
  vec3 t1 = cross(c, vec3(0.0, 1.0, 0.0));
  t1 = length(t1) < 1e-4 ? vec3(1.0, 0.0, 0.0) : normalize(t1);
  vec3 t2 = cross(t1, c);
  return vec2(dot(d, t1), dot(d, t2)) / r;
}

// Snap a direction to a lat/long pixel grid with ~square cells (P cells per radian).
vec3 quantDir(float lat, float lon, float P) {
  float latQ = (floor(lat * P) + 0.5) / P;
  float cl = max(cos(latQ), 0.05);
  float lonQ = (floor(lon * P * cl) + 0.5) / (P * cl);
  float c = cos(latQ);
  return vec3(c * cos(lonQ), sin(latQ), c * sin(lonQ));
}

// Stars on a latitude/longitude grid with ~square cells (cells per row follow cos(latitude)).
vec3 stars(float lat, float lon) {
  float N = uStarDensity;
  // Fine 1-px stars
  float row = floor(lat * N);
  float rowLat = (row + 0.5) / N;
  float cells = max(1.0, floor(TAU * N * cos(rowLat)));
  vec2 cell = vec2(floor((lon / TAU + 0.5) * cells), row);
  float h = hash12(cell);
  float star = step(0.9962, h);
  float tw = 0.55 + 0.45 * sin(uTime * (1.2 + 3.5 * fract(h * 37.0)) + h * 91.0);
  // Mostly faint stars with a few bright ones (a uniform spread made every star bloom).
  float mag = fract(h * 113.0);
  float b = star * tw * (0.3 + 1.6 * mag * mag * mag);
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), step(0.6, fract(h * 7.0)));
  vec3 col = tint * b;

  // Coarse cells with a plus-shaped bright star (5x5 px pattern)
  float N2 = N / 5.0;
  float row2 = floor(lat * N2);
  float rowLat2 = (row2 + 0.5) / N2;
  float cells2 = max(1.0, floor(TAU * N2 * cos(rowLat2)));
  float u2 = (lon / TAU + 0.5) * cells2;
  float v2 = lat * N2;
  float h2 = hash12(vec2(floor(u2), row2) + 71.3);
  vec2 f = floor(vec2(fract(u2), fract(v2)) * 5.0);
  float m = abs(f.x - 2.0) + abs(f.y - 2.0);
  float centre = step(m, 0.5);
  float arm = step(m, 1.5) - centre;
  float tw2 = 0.6 + 0.4 * sin(uTime * (0.7 + 1.8 * h2) + h2 * 50.0);
  float big = step(0.991, h2) * (centre * 2.2 + arm * 0.6) * tw2;
  vec3 tint2 = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.78), step(0.5, fract(h2 * 13.0)));
  col += tint2 * big;
  return col;
}

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = skyGradient(y);

  vec3 sunDir = normalize(uSunDir);
  vec3 moonDir = normalize(uMoonDir);
  float lat = asin(clamp(y, -1.0, 1.0));
  float lon = atan(d.z, d.x);

  // ---------------------------------------------------------------- sun glow
  float cs = dot(d, sunDir);
  float cs0 = max(cs, 0.0);
  float sunUp = smoothstep(-0.3, 0.02, sunDir.y);
  float halo = pow(cs0, 8.0) * 0.1 + pow(cs0, 42.0) * 0.28 + pow(cs0, 600.0) * 1.1;
  vec2 dh = d.xz / max(length(d.xz), 1e-4);
  vec2 shz = sunDir.xz / max(length(sunDir.xz), 1e-4);
  float az = dot(dh, shz) * 0.5 + 0.5;
  float lowSun = 1.0 - smoothstep(0.02, 0.6, sunDir.y);
  float band = exp(-abs(y) * 8.0) * pow(az, 3.0) * lowSun;
  vec3 glowCol = uSunColor * uGlow;
  col += glowCol * (halo + band * 0.32) * sunUp;

  // Cloud pixel grid (constant on-screen size), shared by both cloud layers.
  vec3 qd = quantDir(lat, lon, uCloudPixel);

  if (y > 0.0) {
    // ------------------------------------------------------------- stars
    float starMask = uNight * uNight * smoothstep(0.03, 0.35, y);
    if (starMask > 0.002) col += stars(lat, lon) * starMask;

    // -------------------------------------- moon (pixel disc, gibbous, halo)
    float cm = dot(d, moonDir);
    float moonVis = smoothstep(0.25, 0.8, uNight) * smoothstep(-0.02, 0.08, moonDir.y);
    if (moonVis > 0.001 && cm > 0.0) {
      vec2 mp = discCoord(d, moonDir, uMoonSize);
      vec2 mcell = floor(mp * 7.0);
      vec2 mq = (mcell + 0.5) / 7.0;
      float inside = step(length(mq), 1.0);
      float mottle = hash12(mcell + 13.0);
      float crater = step(0.78, mottle) * 0.22 + step(0.93, mottle) * 0.12;
      float phase = smoothstep(0.35, 0.95, length(mq - vec2(-0.55, 0.25)));
      // Kept below the bloom-saturation point so the pixel craters and the gibbous phase read.
      vec3 moonCol = vec3(0.84, 0.9, 1.0) * (0.95 - crater * 1.3) * mix(0.22, 1.0, phase);
      col = mix(col, moonCol, inside * moonVis);
      float cm0 = max(cm, 0.0);
      col += vec3(0.45, 0.58, 1.0) * (pow(cm0, 2500.0) * 0.3 + pow(cm0, 200.0) * 0.08 + pow(cm0, 12.0) * 0.025) * moonVis;
    }

    // ------------------------------------ sun disc (pixel-crisp, HDR bloom)
    if (cs > 0.0) {
      vec2 sp = discCoord(d, sunDir, uSunSize);
      vec2 sq = (floor(sp * 6.0) + 0.5) / 6.0;
      float r = length(sq);
      float sIn = step(r, 1.0);
      float rim = step(0.8, r);
      col += uSunColor * sIn * mix(1.0, 0.55, rim) * uSunIntensity * sunUp * smoothstep(-0.005, 0.01, y);
    }

    // --------------------------- clouds (plane overhead, lit from the sun side)
    if (uClouds > 0.001) {
      vec2 cp = qd.xz / (max(qd.y, 0.0) + 0.15) * 2.4 + uWind * uTime;
      float n = fbm4(cp * 1.2);
      float c = smoothstep(1.0 - uClouds - 0.08, 1.0 - uClouds + 0.2, n);
      float n2 = fbm4((cp + shz * 0.16) * 1.2);
      float lit = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
      c = floor(c * 3.0 + 0.5) / 3.0;
      lit = floor(lit * 3.0 + 0.5) / 3.0;
      float moonLit = pow(max(dot(d, moonDir), 0.0), 6.0) * smoothstep(0.3, 0.9, uNight);
      vec3 shade = mix(mix(uTop, uHorizon, 0.5) * 0.95, uTop * 0.8, uNight);
      vec3 litCol = mix(uHorizon * 1.12, mix(uTop, uHorizon, 0.55) + vec3(0.05, 0.07, 0.12) * moonLit, uNight)
                  + glowCol * (0.12 + pow(cs0, 4.0) * 0.8) * sunUp;
      vec3 cloudCol = mix(shade, litCol, lit);
      float fade = smoothstep(0.0, 0.22, y);
      col = mix(col, cloudCol, c * fade * mix(0.9, 0.55, uNight));
    }
  } else if (uLowerClouds > 0.001) {
    // ------------------------------------------------------ sea of clouds below
    vec2 lp = qd.xz / (max(-qd.y, 0.0) + 0.07) * 0.6 + uWind * uTime * 0.6 + vec2(37.0, 11.0);
    float n = fbm4(lp);
    float c = smoothstep(0.42, 0.74, n);
    float n2 = fbm4(lp + shz * 0.12);
    float lit = clamp(0.5 + (n - n2) * 5.0, 0.0, 1.0);
    lit = floor(lit * 3.0 + 0.5) / 3.0;
    c = floor(c * 3.0 + 0.5) / 3.0;
    vec3 topCol = uHorizon * 1.08 + glowCol * (0.06 + band * 0.25) * sunUp;
    vec3 shadeCol = mix(uBottom, uHorizon, 0.5);
    vec3 cc = mix(shadeCol, topCol, 0.3 + lit * 0.7);
    float distFade = smoothstep(0.0, 0.16, -y);
    col = mix(col, cc, c * uLowerClouds * distFade);
  }

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,Ta=new l,Ea=class e{constructor({radius:t=180,cloudCover:n=.45,lowerClouds:r=.5,starDensity:i=1100,sunSize:a=.032,moonSize:o=.026,sunIntensity:s=9,cloudPixel:c=380,wind:u=[.012,.004],earlyZ:d=!0}={}){this.radius=t,this.uniforms={uTop:{value:new F(3833568)},uHorizon:{value:new F(12902642)},uBottom:{value:new F(9417936)},uSunDir:{value:new l(.3,.6,-.5).normalize()},uMoonDir:{value:new l(-.3,.6,-.5).normalize()},uSunColor:{value:new F(1,.9,.75)},uNight:{value:0},uGlow:{value:1},uClouds:{value:n},uLowerClouds:{value:r},uTime:{value:0},uStarDensity:{value:i},uSunSize:{value:a},uMoonSize:{value:o},uSunIntensity:{value:s},uCloudPixel:{value:c},uWind:{value:new C(u[0],u[1])}},this.material=new me({name:`SkyMaterial`,uniforms:this.uniforms,vertexShader:Ca,fragmentShader:wa,side:1,depthWrite:!1,depthTest:d,fog:!1,toneMapped:!0}),this.geometry=new Pe(t,48,24);let f=new E(this.geometry,this.material);f.name=`Sky`,f.renderOrder=d?e.EARLY_Z_RENDER_ORDER:-1e3,f.frustumCulled=!1,f.castShadow=!1,f.receiveShadow=!1,f.matrixAutoUpdate=!1,f.onBeforeRender=(e,t,n)=>{Ta.setFromMatrixPosition(n.matrixWorld),f.position.copy(Ta),f.updateMatrix(),f.matrixWorld.copy(f.matrix)},this.object=f}setState({top:e,horizon:t,bottom:n,sunDirection:r,sunColor:i,night:a,moonDirection:o,glow:s,clouds:c}={}){let l=this.uniforms;e&&l.uTop.value.copy(e),t&&l.uHorizon.value.copy(t),n&&l.uBottom.value.copy(n),r&&l.uSunDir.value.copy(r),i&&l.uSunColor.value.copy(i),a!==void 0&&(l.uNight.value=a),o&&l.uMoonDir.value.copy(o),s!==void 0&&(l.uGlow.value=s),c!==void 0&&(l.uClouds.value=c)}get cloudCover(){return this.uniforms.uClouds.value}set cloudCover(e){this.uniforms.uClouds.value=e}get lowerClouds(){return this.uniforms.uLowerClouds.value}set lowerClouds(e){this.uniforms.uLowerClouds.value=e}update(e){this.uniforms.uTime.value+=e}dispose(){this.geometry.dispose(),this.material.dispose()}};Ea.EARLY_Z_RENDER_ORDER=1e6;var Da=[{t:0,name:`night`,top:`#050a1f`,horizon:`#1b2a5c`,bottom:`#0a1232`,sun:`#7294ff`,sunI:.85,hemiSky:`#2a48b4`,hemiGround:`#101430`,hemiI:1.12,fog:.011,exp:1.3,night:1,moon:1,shadow:.6,glow:.4,clouds:.3},{t:4.3,name:`late night`,top:`#070c24`,horizon:`#213062`,bottom:`#0d1436`,sun:`#7a98ff`,sunI:.72,hemiSky:`#2e4ab0`,hemiGround:`#121632`,hemiI:1.1,fog:.0115,exp:1.3,night:1,moon:1,shadow:.58,glow:.5,clouds:.34},{t:5.25,name:`pre-dawn`,top:`#18204e`,horizon:`#5c5a92`,bottom:`#282852`,sun:`#a0a6ea`,sunI:.16,hemiSky:`#5460a8`,hemiGround:`#221e38`,hemiI:1.05,fog:.014,exp:1.26,night:.86,moon:1,shadow:.35,glow:.8,clouds:.45},{t:6.1,name:`pink dawn`,top:`#3c5098`,horizon:`#f59aa0`,bottom:`#8a6aa0`,sun:`#ff7c6a`,sunI:2.3,hemiSky:`#9a86d2`,hemiGround:`#6a4450`,hemiI:.98,fog:.012,exp:1.08,night:.3,moon:0,shadow:.85,glow:1,clouds:.45},{t:6.9,name:`sunrise`,top:`#4a74c4`,horizon:`#f8c0a0`,bottom:`#a08aa8`,sun:`#ffb88a`,sunI:2.8,hemiSky:`#98aee0`,hemiGround:`#6e5048`,hemiI:1.05,fog:.013,exp:1.06,night:.06,moon:0,shadow:.95,glow:1,clouds:.44},{t:8,name:`morning`,top:`#4f86d6`,horizon:`#d6e6f0`,bottom:`#9cb6cc`,sun:`#ffe6c0`,sunI:3.2,hemiSky:`#a2c2ec`,hemiGround:`#6e5c46`,hemiI:1.05,fog:.011,exp:1.02,night:0,moon:0,shadow:1,glow:.8,clouds:.42},{t:12.2,name:`noon`,top:`#3a7ee0`,horizon:`#c4e0f2`,bottom:`#8fb4d0`,sun:`#fff4e2`,sunI:3.5,hemiSky:`#a6c8f2`,hemiGround:`#72624a`,hemiI:1.1,fog:.009,exp:1,night:0,moon:0,shadow:1,glow:.7,clouds:.38},{t:15.3,name:`afternoon`,top:`#4880d8`,horizon:`#dde2da`,bottom:`#9eb0c0`,sun:`#ffe0b0`,sunI:3.6,hemiSky:`#9cb8e8`,hemiGround:`#786248`,hemiI:1.1,fog:.0095,exp:1,night:0,moon:0,shadow:1,glow:.8,clouds:.42},{t:17.2,name:`golden hour`,top:`#3e4c9a`,horizon:`#f7a068`,bottom:`#a0628a`,sun:`#ffb466`,sunI:6,hemiSky:`#7078cc`,hemiGround:`#9a6444`,hemiI:1.45,fog:.0098,exp:1.12,night:0,moon:0,shadow:1,glow:1,clouds:.48},{t:18.45,name:`sunset`,top:`#2a2a70`,horizon:`#ec7e6c`,bottom:`#643a70`,sun:`#ff8050`,sunI:3.1,hemiSky:`#6c5ec4`,hemiGround:`#4c2e44`,hemiI:1.2,fog:.0112,exp:1.12,night:.22,moon:0,shadow:.85,glow:1.3,clouds:.5},{t:19.25,name:`purple dusk`,top:`#1a1c54`,horizon:`#8a5a9e`,bottom:`#2c2052`,sun:`#c07aaa`,sunI:.3,hemiSky:`#4c4ea8`,hemiGround:`#2a1c36`,hemiI:1.15,fog:.013,exp:1.28,night:.62,moon:0,shadow:.5,glow:.9,clouds:.46},{t:20.05,name:`blue hour`,top:`#0b1240`,horizon:`#2c3e82`,bottom:`#111a40`,sun:`#7090f4`,sunI:.38,hemiSky:`#304cae`,hemiGround:`#12152e`,hemiI:1.08,fog:.0125,exp:1.28,night:.92,moon:1,shadow:.5,glow:.5,clouds:.42},{t:21.4,name:`night`,top:`#060b20`,horizon:`#1c2b5c`,bottom:`#0b1332`,sun:`#7294ff`,sunI:.82,hemiSky:`#2a48b4`,hemiGround:`#101430`,hemiI:1.12,fog:.011,exp:1.3,night:1,moon:1,shadow:.6,glow:.4,clouds:.3}],Oa=[`top`,`horizon`,`bottom`,`sun`,`hemiSky`,`hemiGround`],ka=[`sunI`,`hemiI`,`fog`,`exp`,`night`,`moon`,`shadow`,`glow`,`clouds`],Aa=Oa.length*3+ka.length,ja=Oa.length*3,Ma=Object.fromEntries(ka.map((e,t)=>[e,ja+t])),Na=3.5,Pa=class{constructor(e,t,n,r=24){let i=e.length;this.n=i,this.channels=n,this.period=r,this.t=new Float64Array(i+1),this.y=new Float64Array((i+1)*n),this.m=new Float64Array((i+1)*n);for(let t=0;t<i;t++)this.t[t]=e[t];this.t[i]=e[0]+r,this.y.set(t.subarray(0,i*n)),this.y.set(t.subarray(0,n),i*n);let a=new Float64Array(i);for(let e=0;e<i;e++)a[e]=this.t[e+1]-this.t[e];let o=new Float64Array(i);for(let e=0;e<n;e++){for(let t=0;t<i;t++)o[t]=(this.y[(t+1)*n+e]-this.y[t*n+e])/a[t];for(let t=0;t<i;t++){let r=(t-1+i)%i,s=o[r],c=o[t],l=0;if(s*c>0){let e=a[r],n=a[t],i=2*n+e,o=n+2*e;l=(i+o)/(i/s+o/c)}this.m[t*n+e]=l}this.m[i*n+e]=this.m[e]}}evaluate(e,t){let{n,channels:r,t:i}=this,a=e-i[0];a=(a%this.period+this.period)%this.period+i[0];let o=0;for(;o<n-1&&a>=i[o+1];)o++;let s=i[o+1]-i[o],c=(a-i[o])/s,l=c*c,u=l*c,d=2*u-3*l+1,f=(u-2*l+c)*s,p=-2*u+3*l,m=(u-l)*s,h=o*r,g=(o+1)*r;for(let e=0;e<r;e++)t[e]=d*this.y[h+e]+f*this.m[h+e]+p*this.y[g+e]+m*this.m[g+e];return t}};function Fa(e,t,n,r){let i=(e-t.noon)/24*Math.PI*2,a=t.lat*b,o=t.dec*b,s=Math.cos(o),c=Math.sin(o),l=Math.cos(i),u=Math.sin(i),d=Math.sin(a),f=Math.cos(a),p=-s*u,m=c*d+s*l*f,h=-c*f+s*l*d,g=Math.cos(n),_=Math.sin(n);return r.set(p*g+h*_,m,-p*_+h*g).normalize()}function Ia(e,t,n){let r=Fa(t,e,0,new l);return n*b-Math.atan2(r.x,r.z)}var La=(e,t,n)=>.5*(e+t+Math.sqrt((e-t)*(e-t)+n*n)),Ra=(e,t,n)=>.5*(e+t-Math.sqrt((e-t)*(e-t)+n*n));function za(e){return e=(e+Math.PI)%(Math.PI*2),e<0&&(e+=Math.PI*2),e-Math.PI}function Ba(e,t){let n=Math.floor(e),r=e-n,i=r*r*(3-2*r);return f(a(n,0,t),a(n+1,0,t),i)}function Va(e,t){return Ba(e,t)*.55+Ba(e*2.37+11.3,t+17)*.3+Ba(e*5.13+3.1,t+41)*.15}var $=new l,Ha=new l,Ua=new l,Wa=new l,Ga=new l,Ka=(e,t)=>t.setStyle(e,Oe),qa=class{constructor(e,t={}){this.name=`lighting`,this.engine=e,this.renderer=e.renderer,this.scene=e.scene,this.camera=e.camera,this.timeOfDay=((t.timeOfDay??17.2)%24+24)%24,this.timeSpeed=t.timeSpeed??0,this.paused=!1,this.settings={sunMul:1,ambientMul:1,fogMul:1,shadows:!0,exposureMul:1,pointLightMul:1,flicker:!0,backdrop:null},this._clearBefore=null,this._backdropApplied=null,this.shadowMapSize=t.shadowMapSize??2048,this._shadowExtent=t.shadowExtent??22,this.lightDistance=t.lightDistance??70,this.minElevation=(t.minElevation??10)*b,this.maxElevation=(t.maxElevation??68)*b,this.followPlaneY=t.followPlaneY??0,this.shadowForward=t.shadowForward??.22,this.shadowRadius={day:2.5,night:3.2},this.sunPath={noon:12.4,lat:45,dec:5,refTime:17.2,refAzimuth:-125,...t.sunPath||{}},this.moonPath={noon:23.6,lat:45,dec:2,refTime:0,refAzimuth:140,...t.moonPath||{}},this._sunYaw=Ia(this.sunPath,this.sunPath.refTime,this.sunPath.refAzimuth),this._moonYaw=Ia(this.moonPath,this.moonPath.refTime,this.moonPath.refAzimuth),this.group=new s,this.group.name=`LightingSystem`,this.sun=new oe(16777215,3),this.sun.name=`Sun`,this.sun.castShadow=!0;let n=this.sun.shadow;n.mapSize.set(this.shadowMapSize,this.shadowMapSize),n.bias=-2e-4,n.normalBias=.055,n.radius=this.shadowRadius.day,n.camera.near=1,n.camera.far=this.lightDistance*2.4,this._applyShadowExtent(),this.group.add(this.sun,this.sun.target),this.hemi=new Se(10535167,6309944,1),this.hemi.name=`Hemisphere`,this.hemi.position.set(0,1,0),this.group.add(this.hemi),this.pointLightGroup=new s,this.pointLightGroup.name=`PointLights`,this.group.add(this.pointLightGroup),this.sky=new Ea(t.sky),this.scene.add(this.group),this.scene.add(this.sky.object),this.fog=new Ne(10465480,.012),this._previousFog=this.scene.fog,this.scene.fog=this.fog,this.renderer?.shadowMap&&(this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type===2&&(this.renderer.shadowMap.type=1)),this._values=new Float64Array(Aa),this.setKeyframes(t.keyframes??Da),this.state={skyTop:new F,skyHorizon:new F,skyBottom:new F,sunColor:new F,hemiSky:new F,hemiGround:new F,sunIntensity:0,hemiIntensity:0,fogDensity:0,exposure:1,night:0,moonBlend:0,shadowIntensity:1,glow:1,clouds:.4,sunElevation:0,lightElevation:0},this._sunDir=new l(0,1,0),this._moonDir=new l(0,1,0),this._lightDir=new l(0,1,0),this._skyState={top:this.state.skyTop,horizon:this.state.skyHorizon,bottom:this.state.skyBottom,sunDirection:this._sunDir,moonDirection:this._moonDir,sunColor:new F,night:0,glow:1,clouds:.4},this._follow=null,this._clock=0,this._pointLights=[],this._emissives=[],this._nightFactor=0,this._apply(0)}setTime(e){this.timeOfDay=(e%24+24)%24,this._apply(0)}get nightFactor(){return this._nightFactor}get phaseName(){let e=``,t=1/0,n=this.timeOfDay;for(let r=0;r<this.keyframes.length;r++){let i=this.keyframes[r],a=Math.min(Math.abs(i.t-n),24-Math.abs(i.t-n));a<t&&(t=a,e=i.name??``)}return e}get sunDirection(){return this._lightDir}get trueSunDirection(){return this._sunDir}get moonDirection(){return this._moonDir}get shadowExtent(){return this._shadowExtent}set shadowExtent(e){this._shadowExtent=e,this._applyShadowExtent()}setShadowDepthRange(e,t){let n=this.sun.shadow.camera;this._shadowBase??={near:n.near,far:n.far,bias:this.sun.shadow.bias};let r=this._shadowBase;e==null||t==null?(n.near=r.near,n.far=r.far,this.sun.shadow.bias=r.bias):(n.near=Math.max(.1,this.lightDistance-e),n.far=Math.max(n.near+1,this.lightDistance+t),this.sun.shadow.bias=r.bias*((r.far-r.near)/(n.far-n.near))),n.updateProjectionMatrix()}_setBackdrop(e){this.sky.object.visible=!e,this._backdropApplied=e?(this._backdropApplied??new F).copy(e):null;let t=this.renderer;if(t){if(e){if(!this._clearBefore){let e=new F;t.getClearColor(e),this._clearBefore={color:e,alpha:t.getClearAlpha()}}t.setClearColor(e,1)}else this._clearBefore&&=(t.setClearColor(this._clearBefore.color,this._clearBefore.alpha),null)}}followTarget(e){this._follow=e||null}setKeyframes(e){let t=[...e].sort((e,t)=>e.t-t.t);this.keyframes=t;let n=new Float64Array(t.length*Aa),r=new F;t.forEach((e,t)=>{let i=Da.reduce((t,n)=>Math.abs(n.t-e.t)<Math.abs(t.t-e.t)?n:t);Oa.forEach((a,o)=>{let s=e[a]??i[a];typeof s==`number`?r.setHex(s,Oe):Ka(s,r),n[t*Aa+o*3]=r.r,n[t*Aa+o*3+1]=r.g,n[t*Aa+o*3+2]=r.b}),ka.forEach((r,a)=>{n[t*Aa+ja+a]=e[r]??i[r]})}),this._track=new Pa(t.map(e=>(e.t%24+24)%24),n,Aa,24),this.state&&this._apply(0)}addPointLight({position:e,color:t=16757867,intensity:n=8,distance:r=8,decay:i=2,flicker:a=.3,nightOnly:o=!0,dayIntensity:s=.15,seed:c,flickerSpeed:l=2.6}={}){let u=new pe(t,0,r,i);u.castShadow=!1,e&&u.position.set(e.x,e.y,e.z),this.pointLightGroup.add(u);let d=this._pointLights.length,f=this,p={light:u,intensity:n,flicker:a,nightOnly:o,dayIntensity:s,flickerSpeed:l,seed:c??d*7919+13>>>0,flickerFactor:1,fade:1,dispose(){let e=f._pointLights.indexOf(p);e>=0&&f._pointLights.splice(e,1),u.removeFromParent(),u.dispose()}};return this._pointLights.push(p),this._updatePointLight(p),p}retargetPointLight(e,t={}){let n=e.light;t.position&&n.position.set(t.position.x,t.position.y,t.position.z),t.color!==void 0&&n.color.set(t.color),t.distance!==void 0&&(n.distance=t.distance),t.decay!==void 0&&(n.decay=t.decay);for(let n of[`intensity`,`flicker`,`nightOnly`,`dayIntensity`,`seed`,`flickerSpeed`])t[n]!==void 0&&(e[n]=t[n]);return this._updatePointLight(e),e}flickerAt(e,t,n=2.6){if(!this.settings.flicker||!(t>0))return 1;let r=Va(this._clock*n,e);return Math.max(0,1+t*(r-.5)*1.7)}registerEmissive(e,{day:t=0,night:n=1.6,flicker:r=null}={}){let i=this,a={material:e,day:t,night:n,flicker:r,dispose(){let e=i._emissives.indexOf(a);e>=0&&i._emissives.splice(e,1)}};return this._emissives.push(a),this._updateEmissive(a),a}update(e){!this.paused&&this.timeSpeed!==0&&(this.timeOfDay=((this.timeOfDay+this.timeSpeed*e)%24+24)%24),this._apply(e)}lateUpdate(){this._placeSun()}dispose(){for(let e of[...this._pointLights])e.dispose();this._emissives.length=0,this.sun.dispose(),this.hemi.dispose(),this.group.removeFromParent(),this.sky.object.removeFromParent(),this.sky.dispose(),this.scene.fog===this.fog&&(this.scene.fog=this._previousFog??null)}_applyShadowExtent(){let e=this.sun.shadow.camera,t=this._shadowExtent;e.left=-t,e.right=t,e.top=t,e.bottom=-t,e.updateProjectionMatrix()}_apply(e){this._clock+=e;let t=this._track.evaluate(this.timeOfDay,this._values),n=this.state,r=this._stateColors||=[n.skyTop,n.skyHorizon,n.skyBottom,n.sunColor,n.hemiSky,n.hemiGround];for(let e=0;e<6;e++)r[e].setRGB(Math.max(0,t[e*3]),Math.max(0,t[e*3+1]),Math.max(0,t[e*3+2]));n.sunIntensity=Math.max(0,t[Ma.sunI]),n.hemiIntensity=Math.max(0,t[Ma.hemiI]),n.fogDensity=Math.max(0,t[Ma.fog]),n.exposure=Math.max(.05,t[Ma.exp]),n.night=_(t[Ma.night]),n.moonBlend=_(t[Ma.moon]),n.shadowIntensity=_(t[Ma.shadow]),n.glow=Math.max(0,t[Ma.glow]),n.clouds=_(t[Ma.clouds]),this._nightFactor=n.night,this._computeDirections();let i=this.settings;this.sun.color.copy(n.sunColor),this.sun.intensity=n.sunIntensity*i.sunMul;let a=this.sun.shadow;a.intensity=i.shadows?n.shadowIntensity:0,a.autoUpdate=!!i.shadows,a.radius=f(this.shadowRadius.day,this.shadowRadius.night,n.night),this._placeSun(),this.hemi.color.copy(n.hemiSky),this.hemi.groundColor.copy(n.hemiGround),this.hemi.intensity=n.hemiIntensity*i.ambientMul;let o=i.backdrop;this.fog.color.copy(o??n.skyHorizon),this.fog.density=n.fogDensity*i.fogMul,this.scene.fog!==this.fog&&this.scene.fog==null&&(this.scene.fog=this.fog);let s=this._backdropApplied;(this.sky.object.visible===!!o||o&&!(s&&s.equals(o)))&&this._setBackdrop(o),this.renderer&&(this.renderer.toneMappingExposure=n.exposure*i.exposureMul),R.uNight.value=n.night,R.uSunDirection.value.copy(this._lightDir),R.uSunColor.value.copy(n.sunColor).multiplyScalar(n.sunIntensity*i.sunMul/Na),R.uFogColor.value.copy(o??n.skyHorizon);let c=this._skyState;c.sunColor.copy(n.sunColor),c.night=n.night,c.glow=n.glow,c.clouds=n.clouds,this.sky.setState(c),this.sky.update(e);for(let e=0;e<this._pointLights.length;e++)this._updatePointLight(this._pointLights[e]);for(let e=0;e<this._emissives.length;e++)this._updateEmissive(this._emissives[e])}_computeDirections(){let e=this.state;Fa(this.timeOfDay,this.sunPath,this._sunYaw,this._sunDir),Fa(this.timeOfDay,this.moonPath,this._moonYaw,this._moonDir);let t=Math.asin(_(this._sunDir.y,-1,1)),n=Math.asin(_(this._moonDir.y,-1,1));e.sunElevation=t;let r=.12,i=this.minElevation,a=this.maxElevation,o=Ra(La(t,i,r),a,r),s=Ra(La(n,i,r),a,r),c=Math.atan2(this._sunDir.x,this._sunDir.z),l=Math.atan2(this._moonDir.x,this._moonDir.z),u=e.moonBlend,d=c+za(l-c)*u,p=f(o,s,u);e.lightElevation=p;let m=Math.cos(p);this._lightDir.set(Math.sin(d)*m,Math.sin(p),Math.cos(d)*m)}_getFollowPoint(e){let t=this._follow;if(t&&t.isObject3D)return t.getWorldPosition(e);if(t&&t.isVector3)return e.copy(t);let n=this.camera;if(!n)return e.set(0,0,0);Ga.setFromMatrixPosition(n.matrixWorld),n.getWorldDirection(Wa);let r=24;return Wa.y<-.05&&(r=Math.min(60,(Ga.y-this.followPlaneY)/-Wa.y)),e.copy(Ga).addScaledVector(Wa,Math.max(0,r))}_placeSun(){let e=this._lightDir,t=this.camera;if(t&&t.updateWorldMatrix(!0,!1),this._getFollowPoint($),t&&this.shadowForward!==0){Ga.setFromMatrixPosition(t.matrixWorld);let e=$.x-Ga.x,n=$.z-Ga.z,r=Math.hypot(e,n);if(r>.001){let t=Ga.distanceTo($),i=Math.min(t*this.shadowForward,this._shadowExtent*.5)/r;$.x+=e*i,$.z+=n*i}}let n=this.sun.shadow.camera.up;Ha.crossVectors(n,e),Ha.lengthSq()<1e-8&&Ha.set(1,0,0),Ha.normalize(),Ua.crossVectors(e,Ha);let r=2*this._shadowExtent/this.shadowMapSize,i=$.dot(Ha),a=$.dot(Ua),o=Math.round(i/r)*r-i,s=Math.round(a/r)*r-a;$.addScaledVector(Ha,o).addScaledVector(Ua,s),this.sun.target.position.copy($),this.sun.position.copy($).addScaledVector(e,this.lightDistance),this.sun.target.updateMatrixWorld(),this.sun.updateMatrixWorld()}_updatePointLight(e){let t=this.settings,n=1;if(t.flicker&&e.flicker>0){let t=Va(this._clock*e.flickerSpeed,e.seed);n=Math.max(0,1+e.flicker*(t-.5)*1.7)}e.flickerFactor=n;let r=e.nightOnly?f(e.dayIntensity,1,this._nightFactor):1,i=e.intensity*r*n*t.pointLightMul;e.light.intensity=e.fade===1||e.fade===void 0?i:i*e.fade}_updateEmissive(e){let t=f(e.day,e.night,this._nightFactor);e.flicker&&(t*=f(1,e.flicker.flickerFactor,.6)),e.material.emissiveIntensity=t}},Ja=class{constructor(e,t=[],n={}){if(this.lighting=e,this.descriptors=t.slice(),this.size=Math.max(0,Math.floor(n.size??12)),this.fixed=!!n.fixed,this.interval=n.interval??.2,this.fadeTime=n.fadeTime??.35,this.margin=n.margin??4,this.priorityWeight=n.priorityWeight??1.5,this.hysteresis=n.hysteresis??2,this.dayPenalty=n.dayPenalty??10,this.nightDayIntensity=n.nightDayIntensity??.05,this.pooled=this.descriptors.length>this.size,this.handles=[],this._slots=[],this._sources=new Map,this._emissives=[],this._timer=0,this._snapNext=!0,this._frustum=new ee,this._m=new ae,this._sphere=new se,this._scored=this.descriptors.map(e=>({d:e,s:0})),this._wanted=new Set,this._seeds=new Map,this._baseSeeds=[],this._hidden=new Set,this._staticFading=!1,this.fixed){for(let e=0;e<this.size;e++)this.handles.push(this._addParked());this._baseSeeds=this.handles.map(e=>e.seed);let e=this.descriptors;this.descriptors=[],this.pooled=!1,this.setDescriptors(e,{snap:!0});return}if(!this.pooled){for(let t of this.descriptors){let n=e.addPointLight(this._staticParams(t));n.tag=t.tag,n.desc=t,this.handles.push(n)}this._baseSeeds=this.handles.map(e=>e.seed);return}for(let e of this.descriptors)this._seeds.set(e,e.seed??eo(e.position));for(let t=0;t<this.size;t++){let t=e.addPointLight({position:Ya,intensity:0,distance:8,flicker:0,nightOnly:!1});t.fade=0,t.tag=``,t.desc=null,this.handles.push(t),this._slots.push({handle:t,desc:null,target:null,fade:0})}this._baseSeeds=this.handles.map(e=>e.seed)}get activeCount(){if(!this.pooled)return Math.min(this.handles.length,this.descriptors.length);let e=0;for(let t of this._slots)t.desc&&e++;return e}get used(){return this.activeCount}get active(){return this.pooled?this._slots.filter(e=>e.desc).map(e=>e.desc):this.descriptors.slice(0,this.handles.length)}snap(){this._snapNext=!0}setHidden(e,t,{instant:n=!1}={}){if(!e||t===this._hidden.has(e))return;if(t?this._hidden.add(e):this._hidden.delete(e),this.pooled){this._timer=0,n&&(this._snapNext=!0);return}let r=this.handles.find(t=>t.desc===e);r&&(n?(r.fade=+!t,t&&(r.light.intensity=0)):this._staticFading=!0)}isHidden(e){return this._hidden.has(e)}setDescriptors(e,{snap:t=!1}={}){let n=e.slice(),r=this.descriptors,i=n.length===r.length&&n.every((e,t)=>e===r[t]);if(this.descriptors=n,i||(this._scored=n.map(e=>({d:e,s:0}))),t&&(this._snapNext=!0),!i&&this._hidden.size){let e=new Set(n);for(let t of this._hidden)e.has(t)||this._hidden.delete(t)}let a=this.handles.length,o=this.lighting;if(n.length<=a){this.pooled=!1,this._slots.length=0,this._seeds.clear();for(let e=0;e<a;e++){let r=this.handles[e],i=n[e];if(!i){this._park(r);continue}this._hidden.has(i)?t||r.desc!==i?r.fade=0:this._staticFading=!0:r.fade=1,o.retargetPointLight(r,this._params(i,i.seed??this._baseSeeds[e])),r.tag=i.tag,r.desc=i}return}let s=i?null:new Set(n),c=i?null:$a(r,n,s),l=e=>!e||i||s.has(e)?e:c.get(e)??null;if(!i){let e=new Map;for(let t of n)e.set(t,this._seeds.get(t)??t.seed??eo(t.position));this._seeds=e;for(let[e,t]of[...this._sources]){let n=c.get(e);n&&!this._sources.has(n)&&(this._sources.delete(e),this._sources.set(n,t))}}if(!this.pooled){this.pooled=!0,this._slots=this.handles.map(e=>{let t=l(e.desc??null);return{handle:e,desc:t,target:null,fade:+!!t}});for(let e of this._slots)e.desc||this._park(e.handle),e.handle.desc=e.desc,e.handle.fade=e.fade}else if(!i){let e=new Set;for(let t of this._slots){let n=t.desc,r=l(n);r&&r!==n&&!e.has(r)&&(n=r),n!==t.desc&&(t.desc=n,t.handle.desc=n),t.desc&&s.has(t.desc)&&e.add(t.desc)}let t=new Set;for(let e of this._slots){let n=l(e.target);e.target=n&&!t.has(n)?n:null,e.target&&t.add(e.target)}}for(let e of this._slots)e.desc&&(o.retargetPointLight(e.handle,this._params(e.desc,this._seeds.get(e.desc)??e.handle.seed)),e.handle.tag=e.desc.tag);i||(this._timer=0)}flickerSource(e){let t=this._sources.get(e);return t||(t={flickerFactor:1},this._sources.set(e,t)),t}registerEmissive(e,{day:t=0,night:n=1.6,light:r=null}={}){let i=r?this.flickerSource(r):null,a=this.lighting.registerEmissive(e,{day:t,night:n,flicker:i});return this._emissives.push(a),a}update(e,{focus:t=null,camera:n=null}={}){if(this._updateSources(),!this.pooled){this._snapNext=!1,this._staticFading&&this._fadeStatic(e);return}let r=this.nightDayIntensity;for(let e of this._slots)e.desc&&e.desc.nightOnly!==!1&&e.desc.dayIntensity===void 0&&(e.handle.dayIntensity=r);if(this._snapNext){this._snapNext=!1,this._timer=this.interval,this._assign(t,n);for(let e of this._slots){let t=e.target!==e.desc;t&&this._move(e,e.target),e.fade=+!!e.desc,e.handle.fade=e.fade,t&&e.desc&&this.lighting.retargetPointLight(e.handle,{})}return}this._timer-=e,this._timer<=0&&(this._timer=this.interval,this._assign(t,n));let i=this.fadeTime>0?e/this.fadeTime:1;for(let e of this._slots)e.target===e.desc?e.desc&&(e.fade=Math.min(1,e.fade+i)):(e.fade=e.desc?Math.max(0,e.fade-i):0,e.fade===0&&this._move(e,e.target)),e.handle.fade=e.fade*e.fade*(3-2*e.fade)}_fadeStatic(e){let t=this.fadeTime>0?e/this.fadeTime:1,n=!1;for(let e of this.handles){if(!e.desc)continue;let r=+!this._hidden.has(e.desc);e.fade!==r&&(e.fade=r>e.fade?Math.min(1,e.fade+t):Math.max(0,e.fade-t),e.fade!==r&&(n=!0))}this._staticFading=n}dispose(){for(let e of this._emissives)e.dispose();this._emissives.length=0;for(let e of this.handles)e.dispose();this.handles.length=0,this._slots.length=0,this._sources.clear()}_staticParams(e){let t=e.nightOnly??!0;return{position:e.position,color:e.color,intensity:e.intensity,distance:e.distance,flicker:e.flicker,nightOnly:t,dayIntensity:e.dayIntensity??(t?this.nightDayIntensity:1),...e.seed===void 0?{}:{seed:e.seed},...e.flickerSpeed===void 0?{}:{flickerSpeed:e.flickerSpeed}}}_addParked(){let e=this.lighting.addPointLight({position:Ya,intensity:0,distance:8,flicker:0,nightOnly:!1});return e.fade=0,e.tag=``,e.desc=null,e}_park(e){e.desc=null,e.tag=``,e.fade=0,e.intensity=0,e.light.intensity=0,e.light.position.copy(Ya)}_params(e,t){let n=e.nightOnly??!0;return{position:e.position,color:e.color??16757867,intensity:e.intensity??8,distance:e.distance??8,flicker:e.flicker??.3,nightOnly:n,dayIntensity:e.dayIntensity??(n?this.nightDayIntensity:1),seed:t,flickerSpeed:e.flickerSpeed??2.6}}_move(e,t){e.desc=t;let n=e.handle;if(n.desc=t,n.fade=0,n.light.intensity=0,!t){n.tag=``,n.intensity=0,n.light.position.copy(Ya);return}let r=t.nightOnly??!0;this.lighting.retargetPointLight(n,{position:t.position,color:t.color??16757867,intensity:t.intensity??8,distance:t.distance??8,flicker:t.flicker??.3,nightOnly:r,dayIntensity:t.dayIntensity??(r?this.nightDayIntensity:1),seed:this._seeds.get(t),flickerSpeed:t.flickerSpeed??2.6}),n.tag=t.tag}_assign(e,t){let n=this._wanted;n.clear();let r=null;t&&(t.updateMatrixWorld(),this._m.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),r=this._frustum.setFromProjectionMatrix(this._m,t.coordinateSystem));let i=new Set;for(let e of this._slots)e.target&&i.add(e.target);let a=this.lighting.nightFactor,o=e?.x??0,s=e?.y??0,c=e?.z??0,l=this._scored,u=0;for(let t=0;t<l.length;t++){let n=l[t],d=n.d,p=d.position;if(r&&(this._sphere.center.copy(p),this._sphere.radius=(d.distance??8)+this.margin,!r.intersectsSphere(this._sphere))){n.s=1/0;continue}if(this._hidden.size&&this._hidden.has(d)){n.s=1/0;continue}let m=d.nightOnly??!0?f(d.dayIntensity??this.nightDayIntensity,1,a):1;n.s=(e?Math.hypot(p.x-o,(p.y-s)*.5,p.z-c):0)+(d.priority??3)*this.priorityWeight+(1-Math.min(1,m))*this.dayPenalty-(i.has(d)?this.hysteresis:0),u++}if(u){l.sort((e,t)=>e.s-t.s);for(let e=0;e<Math.min(this.size,u);e++)n.add(l[e].d)}let d=new Set;for(let e of this._slots)e.target&&n.has(e.target)&&!d.has(e.target)?d.add(e.target):e.desc&&n.has(e.desc)&&!d.has(e.desc)?(e.target=e.desc,d.add(e.desc)):e.target=null;let p=this._slots.filter(e=>!e.target).sort((e,t)=>e.fade-t.fade),m=0;for(let e of n){if(d.has(e))continue;let t=p[m++];if(!t)break;t.target=e}}_updateSources(){if(!this._sources.size)return;let e=this.lighting;for(let[t,n]of this._sources){let r=this._handleOf(t);n.flickerFactor=r?r.flickerFactor:e.flickerAt(this._seeds.get(t)??eo(t.position),t.flicker??.3,t.flickerSpeed??2.6)}}_handleOf(e){if(!this.pooled){let t=this.descriptors.indexOf(e);return t>=0?this.handles[t]:null}for(let t of this._slots)if(t.desc===e)return t.handle;return null}},Ya=new l(0,-500,0);function Xa(e){return{position:e.position,color:x(e.color,F.NAMES),intensity:Qa(e.intensity,8,0,200),distance:Qa(e.distance,8,.5,100),flicker:Qa(e.flicker,.2,0,1),nightOnly:e.nightOnly??!0,priority:e.priority??3,tag:e.tag}}function Za(e,{cache:t=null}={}){return e.map((e,t)=>({d:e,i:t,p:e.priority??3})).sort((e,t)=>e.p-t.p||e.i-t.i).map(({d:e})=>{if(!t)return Xa(e);let n=t.get(e);return n||(n=Xa(e),t.set(e,n)),n})}function Qa(e,t,n,r){return e===void 0?void 0:Math.min(r,Math.max(n,Number.isFinite(Number(e))&&e!==null&&e!==``?Number(e):t))}function $a(e,t,n){let r=new Map,i=new Set(e),a=new Map,o=new Map;for(let e of t){if(!e.tag)continue;let t=o.get(e.tag)??0;o.set(e.tag,t+1),i.has(e)||a.set(`${e.tag}#${t}`,e)}if(!a.size)return r;o.clear();for(let t of e){if(!t.tag)continue;let e=o.get(t.tag)??0;if(o.set(t.tag,e+1),n.has(t))continue;let i=a.get(`${t.tag}#${e}`);i&&r.set(t,i)}return r}function eo(e){return e?(Math.imul(Math.round(e.x*64),73856093)^Math.imul(Math.round(e.y*64),19349663)^Math.imul(Math.round(e.z*64),83492791))>>>0:13}var to=new Set,no={campfire:0,hearth:0,wallTorch:1,light:1,lamppost:2,house:3},ro=class e{constructor({textures:e,seed:t=42,factory:n=null}){this.textures=e,this.factory=n??new Je({textures:e,seed:t}),this._ownsFactory=!n}static isBuildable(e){return De[e]?.kind===`prop`}build(t,n){let r=De[t.type];if(!r||r.kind!==`prop`&&t.type!==`enemy`)return null;let i=this.factory,a=(e,t)=>n.getHeight(e,t),o=t.rotation??0,c={...t.opts??{},id:t.id};r.rotatable&&(c.rotation=o);let u=null,d=null;switch(t.type){case`house`:case`windmill`:case`well`:case`marketStall`:case`lamppost`:case`campfire`:case`bench`:case`barrel`:case`crate`:case`crateStack`:case`flowerbox`:case`signpost`:case`rock`:case`haystack`:case`chest`:case`waystone`:case`bed`:case`table`:case`chair`:case`shelf`:case`hearth`:case`counter`:case`rug`:case`staircase`:case`wardrobe`:case`sacks`:t.type===`house`&&!c.upperWall&&delete c.upperWall,u=i[t.type](t.x,a(t.x,t.z),t.z,c);break;case`enemy`:return null;case`tree`:u=i.tree(t.x,a(t.x,t.z),t.z,c),t.collider===!1&&(u.colliders=[]);break;case`wallTorch`:{let e=t.x+Math.sin(o)*.6,n=t.z+Math.cos(o)*.6;u=i.wallTorch(t.x,a(e,n)+(t.dy??2.1),t.z,c);break}case`wallWindow`:{let e=t.x+Math.sin(o)*.6,n=t.z+Math.cos(o)*.6;u=i.wallWindow(t.x,a(e,n),t.z,c);break}case`light`:{let e=new s;e.name=`light:${t.id}`;let n=a(t.x,t.z)+(t.dy??1.5);e.position.set(t.x,n,t.z),u={object:e,colliders:[],emissives:[],emitters:[],lights:[{position:new l(t.x,n,t.z),color:t.color??`#ffb46b`,intensity:t.intensity??8,distance:t.distance??8,flicker:t.flicker??.2,nightOnly:t.nightOnly??!0}],dispose:()=>e.removeFromParent()};break}case`fence`:u=i.fence(t.x0,t.z0,t.x1,t.z1,a((t.x0+t.x1)/2,(t.z0+t.z1)/2),c),d=new l((t.x0+t.x1)/2,0,(t.z0+t.z1)/2);break;case`bridge`:{let e=t.deckY??io(n,t);u=i.bridge(t.x0,t.z0,t.x1,t.z1,e,c),d=new l((t.x0+t.x1)/2,e,(t.z0+t.z1)/2);break}case`waterfall`:{let e=ao(n,t);u={object:e.object,colliders:[],emissives:[],lights:[],emitters:e.emitters??[],update:e.update,dispose:()=>{e.dispose(),e.object.removeFromParent()},waterfall:e},d=new l(t.x,e.bottom,t.z);break}default:return e.isBuildable(t.type)&&!to.has(t.type)&&(to.add(t.type),console.warn(`[Luminati] no build case for the prop type "${t.type}": its objects build nothing`)),null}let f=(u.lights??[]).map(e=>({...e,tag:`${t.type}:${t.id}`,priority:no[t.type]??3}));return t.type===`house`&&!t.light&&(f.length=0),d||=new l(t.x,a(t.x,t.z),t.z),d.y===0&&t.type===`fence`&&(d.y=a(d.x,d.z)),u.object.userData.levelObjectId=t.id,{object:u.object,colliders:u.colliders??[],walkRects:u.walkRects??[],lights:f,emissives:u.emissives??[],emitters:u.emitters??[],update:u.update??null,interact:u.interact??null,anchor:d,source:t,propResult:t.type===`light`||t.type===`waterfall`?null:u,dispose:()=>u.dispose?.()}}dispose(){this._ownsFactory&&this.factory.dispose()}};function io(e,t){let n=t.x1-t.x0,r=t.z1-t.z0,i=Math.hypot(n,r)||1,a=n/i,o=r/i,s=(t,n)=>{let r=e.tileAt(Math.floor(t),Math.floor(n));return r&&!r.water&&!r.type?.void?e.getHeight(t,n):null},c=s(t.x0-a*.5,t.z0-o*.5),l=s(t.x1+a*.5,t.z1+o*.5),u=-1/0;for(let i of[0,.25,.5,.75,1]){let a=e.getWaterSurface(t.x0+n*i,t.z0+r*i);a!=null&&a>u&&(u=a)}let d=c??l;return d==null?u>-1/0?u+.3:e.getHeight(t.x0,t.z0):u>-1/0?Math.max(d,u+.1):d}function ao(e,t){let[n,r]=Qe(t.facing),i=(t,n)=>e.getWaterSurface(t,n)??e.getHeight(t,n),a=i(t.x-n*.5+.01,t.z-r*.5+.01),o=i(t.x+n*.5+.01,t.z+r*.5+.01),s=Xe({x:t.x,z:t.z,width:t.width??2,top:a,bottom:Math.min(o,a-.05),facing:t.facing??`S`});return s.top=a,s.bottom=o,s}function oo(e,t){return He(so(e,t))}function*so(t,{textures:n,chunkSize:r=32,tileMapOptions:i={},deferShore:a=!1}){let o=new Ke(e(t),{textures:n,chunkSize:r,...i,deferBuild:!0});yield*o.buildSteps();let c=new s;c.name=`terrain:${t.name}`,c.add(o.object);let l=null;return t.tiles.some(e=>[...e].some(e=>t.legend[e]?.water))&&(l=new Ge(o,{flow:t.water?.flow??[0,.45],reflect:t.water?.reflect??.2,neutral:t.water?.neutral??.2,glint:co(t),deferShore:a}),c.add(l.object)),{tileMap:o,water:l,object:c,dispose:()=>{l?.dispose(),o.dispose(),c.removeFromParent()}}}function co(e){let t=e?.water?.glint,n=Number(t);return t!==null&&t!==``&&Number.isFinite(n)?Math.max(0,n):1}function lo(e,t=3){let n=1/0,r=-1/0,i=1/0,a=-1/0;if(e.tiles.forEach((t,o)=>{for(let s=0;s<t.length;s++){let c=e.legend[t[s]];!c||c.void||c.water||c.walkable===!1||(n=Math.min(n,s),r=Math.max(r,s+1),i=Math.min(i,o),a=Math.max(a,o+1))}}),!Number.isFinite(n))return{minX:0,maxX:e.width,minZ:0,maxZ:e.depth};let o=(n+r)/2,s=(i+a)/2,c=Math.max(0,(r-n)/2-t),l=Math.max(0,(a-i)/2-t);return{minX:o-c,maxX:o+c,minZ:s-l,maxZ:s+l}}var uo=T({FOREST_KINDS:()=>go,buildOuterGround:()=>wo,forestKindAreas:()=>_o,makeOuterHeight:()=>So,mergeTreeSteps:()=>ho,mergeTrees:()=>mo,outerGroundSteps:()=>To,scatterForest:()=>vo,scatterForestSteps:()=>yo}),fo=new l,po=[`position`,`aCenter`,`aSway`,`aPhase`];function mo(e,t={}){return He(ho(e,t))}function*ho(e,{name:t=`trees`,castShadow:n=!0,maxTriangles:r=1/0,maxExtent:i=1/0,minTriangles:o=0,tags:c=null}={}){let l=new Map,u=!!c?.size,d=[];for(let t of e){let e=t.object,r=u?c.get(t)??null:null;e.updateWorldMatrix(!0,!0);let i=a(Math.round(e.position.x*7),Math.round(e.position.z*7),3)*Math.PI*2;e.traverse(t=>{if(!t.isMesh||Array.isArray(t.material))return;let a=t.material,o=n&&t.castShadow,s=`${a.uuid}|${+o}|${+t.receiveShadow}`,c=l.get(s);c||(c={material:a,castShadow:o,receiveShadow:t.receiveShadow,depth:t.customDepthMaterial,geos:[],pos:[],tags:[]},l.set(s,c));let u=t.geometry.clone();u.applyMatrix4(t.matrixWorld);let d=u.getAttribute(`aCenter`);if(d)for(let e=0;e<d.count;e++)fo.fromBufferAttribute(d,e).applyMatrix4(t.matrixWorld),d.setXYZ(e,fo.x,fo.y,fo.z);let f=u.getAttribute(`aPhase`);if(f)for(let e=0;e<f.count;e++)f.setX(e,f.getX(e)+i);c.geos.push(u),c.pos.push([e.position.x,e.position.z]),c.tags.push(r)}),t.dispose?.(),yield}let f=new s;f.name=t;let p=[];for(let e of l.values()){let n=e.geos.map((e,t)=>t),a=Number.isFinite(r)||Number.isFinite(i)?Ze(n,{x:t=>e.pos[t][0],z:t=>e.pos[t][1],weight:t=>ze(e.geos[t]),maxWeight:r,maxExtent:i,minWeight:o}):[n];u&&(a=a.map(t=>Re(t,t=>e.tags[t])));for(let n=0;n<a.length;n++){let r=a[n],i=qe(r.map(t=>e.geos[t]),!1);if(!i)continue;u&&d.push(...Be(i,r.map(t=>e.geos[t].attributes.position.count),r.map(t=>e.tags[t]),po)),i.computeBoundingSphere(),i.computeBoundingBox(),i.boundingSphere.radius+=1.8,i.boundingBox.expandByScalar(1.8);let o=new E(i,e.material);o.name=`${t}:${e.material.name||`mat`}${a.length>1?`#${n}`:``}`,o.castShadow=e.castShadow,o.receiveShadow=e.receiveShadow,e.depth&&(o.customDepthMaterial=e.depth),o.matrixAutoUpdate=!1,f.add(o),p.push(o),yield}for(let t of e.geos)t.dispose()}return{object:f,meshes:p,ranges:d,dispose(){for(let e of p)e.geometry.dispose();f.removeFromParent()}}}var go=Object.freeze([`oak`,`pine`,`birch`,`autumn`]);function _o(e){let t=e?.forest&&typeof e.forest==`object`&&Array.isArray(e.forest.areas)?e.forest.areas:[],n=[];for(let e of t){if(!e||typeof e!=`object`||![`minX`,`maxX`,`minZ`,`maxZ`].every(t=>Number.isFinite(e[t])))continue;let t=e.kinds&&typeof e.kinds==`object`?e.kinds:{},r=go.map(e=>[e,Number.isFinite(t[e])&&t[e]>0?t[e]:0]).filter(([,e])=>e>0),i=r.reduce((e,[,t])=>e+t,0);if(!(i>0))continue;let a=0,o=r.map(([e,t])=>[e,a+=t/i]);n.push({minX:e.minX,maxX:e.maxX,minZ:e.minZ,maxZ:e.maxZ,cumulative:o})}return n}function vo(e){return He(yo(e))}function*yo({tileMap:e,heightAt:t,seed:n=77,avoid:r=[],southGap:i=0,kindAreas:a=[]}){let o=e.width,s=e.depth,c=new u(n),l=[],d=[],f=[],p=1.35,m=new Map,h=(e,t)=>`${Math.floor(e/p)},${Math.floor(t/p)}`,g=(e,t,n)=>{let i=Math.floor(e/p),a=Math.floor(t/p);for(let r=-2;r<=2;r++)for(let o=-2;o<=2;o++){let s=m.get(`${i+o},${a+r}`);if(s){for(let r of s)if((r.x-e)**2+(r.z-t)**2<(r.r+n)**2)return!1}}for(let i of r)if((i.x-e)**2+(i.z-t)**2<(i.r+n)**2)return!1;return!0},v=(e,t,n)=>{let r={x:e,z:t,r:n};f.push(r);let i=h(e,t),a=m.get(i);a||m.set(i,a=[]),a.push(r)},y=(e,t,r)=>{for(let n=0;n<a.length;n++){let i=a[n];if(!(e<i.minX||e>=i.maxX||t<i.minZ||t>=i.maxZ)){for(let[e,t]of i.cumulative)if(r<t)return e;return i.cumulative[i.cumulative.length-1][0]}}let i=t<6,s=e>o*.72&&t>8,c=Le(e*.09,t*.09,{seed:n+5,octaves:2});return i?r<.5?`pine`:r<.82?`oak`:`birch`:s?r<.5?`autumn`:r<.78?`oak`:r<.9?`pine`:`birch`:c>.55?r<.6?`pine`:`oak`:r<.62?`oak`:r<.82?`pine`:r<.93?`birch`:`autumn`},b=(e,t,n)=>{if(n.char!==`T`||t>=s-3)return;let r=t<3?1:2,i=t>=9?Math.min(e,o-1-e):-1;for(let a=0;a<r;a++){let r=e+c.range(.1,.9),a=t+c.range(.1,.9),o=c.range(.85,1.25);if(!g(r,a,o))continue;let s=y(r,a,c.next()),u=(s===`pine`?5.4:s===`birch`?5.2:5)*c.range(.85,1.25)*(i===1?.8:1);i!==2&&(v(r,a,o),l.push([s,r,n.h,a,u]))}};for(let t=0;t<s;t++){for(let n=0;n<o;n++){let r=e.tileAt(n,t);r&&b(n,t,r)}yield}let x=xo(e,bo);for(let e=0;e<5200;e++){e%400==399&&(yield);let r=c.range(-34,o+34),a=c.range(-44,s+20.4),l=Math.max(0,-r,r-o),u=Math.max(0,-a,a-s),f=Math.hypot(l,u);if(f<.6||i>0&&a>s&&a<s+i||f<bo&&x?.(r,a))continue;let p=Le(r*.075+11,a*.075-4,{seed:n+2,octaves:3}),m=1-N(4,30,f),h=_((p-.42)*2.6+m*(a<0?.35:.75),0,1)*(1-N(24,34,f)*.85);if(c.next()>h)continue;let b=c.range(.95,1.5);if(!g(r,a,b))continue;v(r,a,b);let S=y(r,a,c.next()),C=S===`pine`?5.8:5.2;d.push([S,r,t(r,a),a,C*c.range(.85,1.35)])}return{border:l,outer:d}}var bo=2.5;function xo(e,t){let n=e.width,r=e.depth,i=(t,n)=>{let r=e.tileAt(t,n);return!!r&&!r.water&&!r.type?.void&&(r.type?.walkable??!0)!==!1},a=new Set,o=(e,t)=>{let r=[];for(let o=0;o<=e;o++){let s=o<e?t(o):null;if(s&&i(s[0],s[1])){r.push(s);continue}if(r.length>=3)for(let[e,t]of r)a.add(t*n+e);r=[]}};return o(n,e=>[e,0]),o(n,e=>[e,r-1]),o(r,e=>[0,e]),o(r,e=>[n-1,e]),a.size?(e,i)=>{let o=Math.max(0,Math.floor(e-t)),s=Math.min(n-1,Math.floor(e+t)),c=Math.max(0,Math.floor(i-t)),l=Math.min(r-1,Math.floor(i+t));for(let r=c;r<=l;r++)for(let c=o;c<=s;c++){if(!a.has(r*n+c))continue;let o=Math.max(0,c-e,e-(c+1)),s=Math.max(0,r-i,i-(r+1));if(o*o+s*s<t*t)return!0}return!1}:null}function So(e){let t=e.width,n=e.depth,r=(r,i)=>{let a=-1/0;for(let o of[-.5,.5])for(let s of[-.5,.5]){let c=_(Math.floor(r+o),0,t-1),l=_(Math.floor(i+s),0,n-1),u=e.tileAt(c,l);if(!u)continue;let d=u.water?Math.max(u.h,.5):u.h;d>a&&(a=d)}return Number.isFinite(a)?a:0};return(e,i)=>{let a=_(e,0,t),o=_(i,0,n),s=e-a,c=i-o,l=Math.hypot(s,c),u=r(a,o)-.04;if(l<1e-6)return u;let d=(Le(e*.05,i*.05,{seed:91,octaves:3})-.5)*3.2,f=N(0,10,l),p=u+d*f,m=N(2,-30,i);p+=m*(N(0,40,-i)*7+Le(e*.03,i*.04,{seed:17,octaves:4})*9*N(-6,-40,i));let h=N(-55,-120,i);p+=h*(18+Le(e*.018,3.1,{seed:23,octaves:4})*34);let g=N(18,90,Math.max(-e,e-t,i-n));return p+=g*(4+Le(e*.02,i*.02,{seed:29,octaves:3})*14),Math.max(p,u-.6*f)}}function*Co(e,n,r){let i=e.index,a=e.getAttribute(`position`),o=new t(new Float32Array(a.count*3),3);e.setAttribute(`normal`,o);let s=new l,c=new l,u=new l,d=new l,f=new l,p=new l,m=new l,h=new l,g=0;for(let e=0,t=i.count;e<t;e+=3){let t=i.getX(e),r=i.getX(e+1),l=i.getX(e+2);s.fromBufferAttribute(a,t),c.fromBufferAttribute(a,r),u.fromBufferAttribute(a,l),m.subVectors(u,c),h.subVectors(s,c),m.cross(h),d.fromBufferAttribute(o,t),f.fromBufferAttribute(o,r),p.fromBufferAttribute(o,l),d.add(m),f.add(m),p.add(m),o.setXYZ(t,d.x,d.y,d.z),o.setXYZ(r,f.x,f.y,f.z),o.setXYZ(l,p.x,p.y,p.z),++g===n&&(g=0,yield)}yield;for(let e=0,t=o.count;e<t;e++)fo.fromBufferAttribute(o,e).normalize(),o.setXYZ(e,fo.x,fo.y,fo.z),e%r===r-1&&(yield);o.needsUpdate=!0}function wo(e){let t=To(e),n=t.next();for(;!n.done;)n=t.next();return n.value}function*To({textures:e,tileMap:n,heightAt:r,extent:i=170,rowsPerStep:a=12}){let o=n.width,s=n.depth,c=(e,t)=>{let n=new Set;for(let t=e-i;t<e-40;t+=10)n.add(t);for(let t=e-40;t<e-16;t+=2)n.add(t);for(let r=e-16;r<=t+16;r+=1)n.add(r);for(let e=t+16;e<=t+40;e+=2)n.add(e);for(let e=t+40;e<=t+i;e+=10)n.add(e);return[...n].sort((e,t)=>e-t)},l=c(0,o),u=c(0,s),d=l.length,p=u.length,m=new Float32Array(d*p*3),h=new Float32Array(d*p*2),g=new Float32Array(d*p*3),_=new Float32Array(d*p);for(let e=0;e<p;e++){for(let t=0;t<d;t++){let n=l[t],i=u[e];_[e*d+t]=r(n,i)}e%a===a-1&&(yield)}let v=e.meta(`grass_dark`).units,y=new F,b=new F(1,1,1),x=new F(.78,.86,.72),S=new F(.62,.6,.66);for(let e=0;e<p;e++){for(let t=0;t<d;t++){let n=e*d+t,r=l[t],i=u[e],a=_[n];m[n*3]=r,m[n*3+1]=a,m[n*3+2]=i,h[n*2]=r/v[0],h[n*2+1]=-i/v[1];let c=_[e*d+Math.max(0,t-1)],C=_[e*d+Math.min(d-1,t+1)],w=_[Math.max(0,e-1)*d+t],T=_[Math.min(p-1,e+1)*d+t],E=(C-c)/Math.max(.001,l[Math.min(d-1,t+1)]-l[Math.max(0,t-1)]),D=(T-w)/Math.max(.001,u[Math.min(p-1,e+1)]-u[Math.max(0,e-1)]),O=Math.hypot(E,D),k=Math.max(0,-r,r-o),A=Math.max(0,-i,i-s),j=Math.hypot(k,A);y.copy(b).lerp(x,N(20,80,j)).lerp(S,N(.55,1.2,O));let M=f(.62,1,N(0,14,j))*(.9+.2*Le(r*.11,i*.11,{seed:4,octaves:2}));g[n*3]=y.r*M,g[n*3+1]=y.g*M,g[n*3+2]=y.b*M}e%a===a-1&&(yield)}let C=(e,t)=>e>0&&e<t,w=0;for(let e=0;e<d-1;e++)C((l[e]+l[e+1])/2,o)&&w++;let T=0;for(let e=0;e<p-1;e++)C((u[e]+u[e+1])/2,s)&&T++;let D=(d-1)*(p-1)-w*T,O=d*p-1>=65535?new Uint32Array(D*6):new Uint16Array(D*6),k=0;for(let e=0;e<p-1;e++){let t=C((u[e]+u[e+1])/2,s);for(let n=0;n<d-1;n++){if(t&&C((l[n]+l[n+1])/2,o))continue;let r=e*d+n,i=r+1,a=r+d,s=a+1;O[k++]=r,O[k++]=a,O[k++]=i,O[k++]=i,O[k++]=a,O[k++]=s}e%a===a-1&&(yield)}let A=new fe;A.setAttribute(`position`,new t(m,3)),A.setAttribute(`uv`,new t(h,2)),A.setAttribute(`color`,new t(g,3)),A.setIndex(new t(O,1)),yield,yield*Co(A,a*(d-1)*2,a*d),A.computeBoundingSphere();let j=e.material(`grass_dark`,{vertexColors:!0,normalScale:.35}),M=new E(A,j);return M.name=`OuterGround`,M.receiveShadow=!0,M.castShadow=!1,M.matrixAutoUpdate=!1,M.updateMatrix(),M}function Eo(e){let t=e.map(({kind:e,seed:t})=>Oi(e,{seed:t})),n=Math.max(...t.map(e=>e.frameWidth))+2,r=Math.max(...t.map(e=>e.frameHeight))+1,i=document.createElement(`canvas`);i.width=n*t.length,i.height=r;let a=i.getContext(`2d`);return a.imageSmoothingEnabled=!1,t.forEach((e,t)=>{let i=t*n+Math.floor((n-e.frameWidth)/2),o=r-e.frameHeight;a.drawImage(e.canvas,0,0,e.frameWidth,e.frameHeight,i,o,e.frameWidth,e.frameHeight),e.dispose()}),{texture:ce(i,{wrap:`clamp`,mipmaps:!1,srgb:!0,name:`foliage-strip`}),width:n,height:r,pixelsPerUnit:16,anchor:[.5,0],frames:t.length}}var Do=new Set([`g`,`G`,`f`]),Oo=[1,2,3,1,2];function ko(e){return He(Ao(e))}function*Ao({tileMap:e,isFree:t,seed:n=2024,houses:r=[],trees:i=[],clearings:a=[],flowerAreas:o=[],shrubAreas:c=[],maxInstances:l=1/0}){let d=new u(n),f=new s;f.name=`GroundDetail`;let p=[],m=[],h=[],g=[],_=(e,t)=>{for(let n=0;n<a.length;n++){let r=a[n];if((e-r.x)**2+(t-r.z)**2<r.r*r.r)return!0}return!1},v=(e,t,n)=>{for(let r=0;r<e.length;r++){let i=e[r];if(t>=i.minX&&t<i.maxX&&n>=i.minZ&&n<i.maxZ)return i}return null},y=(t,n,r)=>{for(let i=-1;i<=1;i++)for(let a=-1;a<=1;a++){if(!a&&!i)continue;let o=e.tileAt(t+a,n+i);if(o&&r(o))return!0}return!1},b=(e,r,i)=>{let a=i.char,s=i.h,l=a===`T`;if(Do.has(a)||l){let i=Le(e*.23,r*.23,{seed:n+1,octaves:3}),u=l?2:3+(i>.55?2:0);for(let n=0;n<u;n++){let n=e+d.next(),a=r+d.next();if(!l&&!t(n,a))continue;let o=i>.58&&d.chance(.45),c=d.range(.7,1.05),u=d.chance(.25)?`#e2f2a8`:l?`#b8c8a0`:`#ffffff`,f=!l&&_(n,a);p.push({x:n,y:s,z:a,scale:f?c*.75:c,frame:o&&!f?1:0,tint:u})}let f=l?0:a===`f`?3:i>.6?1:+!!d.chance(.25),h=v(o,e,r)?.palette??Oo;for(let n=0;n<f;n++){let n=e+d.next(),i=r+d.next();if(!t(n,i))continue;let a=d.range(.75,1),o=h[d.int(0,h.length-1)];_(n,i)||m.push({x:n,y:s,z:i,scale:a,frame:o})}let y=l?.55:v(c,e,r)?.chance??.05;if(d.chance(y)){let n=e+d.range(.15,.85),i=r+d.range(.15,.85);if(l||t(n,i)){let e=d.next(),t=e<.45?0:e<.85?1:2,r=d.range(.8,1.2);(l||!_(n,i))&&g.push({x:n,y:s,z:i,scale:r,frame:t})}}if(!l&&d.chance(.035)){let n=e+d.next(),i=r+d.next();t(n,i)&&g.push({x:n,y:s,z:i,scale:d.range(.8,1.1),frame:3})}}else if(a===`s`){let n=y(e,r,e=>e.water),i=n?2:1;for(let a=0;a<i;a++){let i=e+d.next(),a=r+d.next();t(i,a)&&(n&&d.chance(.7)?h.push({x:i,y:s,z:a,scale:d.range(.75,1.1)}):g.push({x:i,y:s,z:a,scale:d.range(.7,1),frame:3}))}}else if(a===`F`)d.chance(.3)&&p.push({x:e+d.next(),y:s,z:r+d.next(),scale:d.range(.55,.75),frame:0,tint:`#d8e4a0`});else if(a===`d`||a===`.`){if(d.chance(.12)){let n=e+d.next(),i=r+d.next();t(n,i)&&p.push({x:n,y:s,z:i,scale:d.range(.5,.7),frame:0,tint:`#d8e0a0`})}}else a===`m`&&d.chance(.35)&&g.push({x:e+d.next(),y:s,z:r+d.next(),scale:d.range(.7,1),frame:d.chance(.5)?1:3})};for(let t=0;t<e.depth;t++){for(let n=0;n<e.width;n++){let r=e.tileAt(n,t);r&&b(n,t,r),(n&31)==31&&(yield)}yield}let x=(t,n)=>{let r=e.tileAt(Math.floor(t),Math.floor(n));return r&&Do.has(r.char)?r:null},S=(e,n,r,i)=>{let a=x(e,n);return!a||!t(e,n)||_(e,n)?!1:(g.push({x:e,y:a.h,z:n,scale:i,frame:r}),!0)};for(let e of r){let t=[[e.minX,e.maxZ,e.maxX,e.maxZ,0,1],[e.minX,e.minZ,e.maxX,e.minZ,0,-1],[e.minX,e.minZ,e.minX,e.maxZ,-1,0],[e.maxX,e.minZ,e.maxX,e.maxZ,1,0]];for(let[n,r,i,a,o,s]of t){let t=Math.hypot(i-n,a-r),c=Math.max(1,Math.round(t/.95));for(let t=0;t<c;t++){if(!d.chance(.62))continue;let l=(t+d.range(.2,.8))/c,u=d.range(.28,.55),f=n+(i-n)*l+o*u,p=r+(a-r)*l+s*u;e.door&&Math.hypot(f-e.door.x,p-e.door.z)<1.25||S(f,p,d.next()<.62?0:1,d.range(.75,1.1))}}}for(let e of i){let t=d.int(1,3);for(let n=0;n<t;n++){let t=d.range(0,Math.PI*2),n=(e.r??.3)+d.range(.35,.8);S(e.x+Math.cos(t)*n,e.z+Math.sin(t)*n,+!!d.chance(.6),d.range(.7,1.05))}}let C=[],w=function*(e,t,r,i={}){if(!r.length)return[];let a=r.length>l?yield*We(r,{x:e=>e.x,z:e=>e.z,maxWeight:l}):[r],o=a.map((t,n)=>[a.length>1?`${e}#${n}`:e,t]),s=[];for(let[e,r]of o){let a=new Xi({sprite:t,instances:r,name:e,seed:n+C.length,...i});f.add(a.object),C.push(a),s.push(a),yield}return s},T=Eo([{kind:`grass_tuft`},{kind:`grass_tall`}]),E=Eo([{kind:`flower_red`},{kind:`flower_yellow`},{kind:`flower_white`},{kind:`flower_blue`}]),D=Eo([{kind:`bush`},{kind:`fern`},{kind:`mushroom`},{kind:`rock_small`}]),O=Oi(`reeds`);yield,yield*w(`Foliage:grass`,T,p,{wind:1}),yield*w(`Foliage:flowers`,E,m,{wind:1.1}),yield*w(`Foliage:reeds`,O,h,{wind:1.4});let k=yield*w(`Foliage:shrubs`,D,g,{wind:.5,rootDarken:.25});for(let e of k)e.castShadow=!0;return{fields:C,object:f,stats:{grass:p.length,flowers:m.length,reeds:h.length,shrubs:g.length},dispose(){for(let e of C)e.dispose();T.texture.dispose(),E.texture.dispose(),D.texture.dispose(),O.dispose()}}}var jo={value:0},Mo=`
	{
		vec3 snowN = inverseTransformDirection( normal, viewMatrix );
		float snowUp = smoothstep( 0.5, 0.86, snowN.y );
		float snowL = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
		float snowK = uSnowCover * snowUp * ( 0.7 + 0.25 * smoothstep( 0.02, 0.2, snowL ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.8, 0.84, 0.92 ) * ( 0.82 + 0.3 * smoothstep( 0.0, 0.3, snowL ) ), snowK );
	}
`,No=`
	{
		float snowL = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
		float snowK = uSnowCover * smoothstep( 0.2, 0.95, vQuadUv.y ) * 0.72;
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.78, 0.83, 0.9 ) * ( 0.7 + 0.6 * sqrt( snowL ) ), snowK );
	}
`;function Po(e,t=`ground`){if(!e||e.userData.luminatiSnow)return;e.userData.luminatiSnow=t;let n=e.onBeforeCompile,r=e.customProgramCacheKey();e.onBeforeCompile=function(e,r){n.call(this,e,r),e.uniforms.uSnowCover=jo;let i=t===`foliage`?No:Mo;e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
uniform float uSnowCover;`).replace(`#include <emissivemap_fragment>`,`${i}\n#include <emissivemap_fragment>`)},e.customProgramCacheKey=()=>`${r}|luminati-snow-${t}`,e.needsUpdate=!0}var Fo=/^luminati:roof/;function Io(e,{roofsOnly:t=!1}={}){e?.traverse(e=>{let n=e.isMesh?e.material:null;!n||Array.isArray(n)||n.userData.luminatiSnow||(!t||Fo.test(n.name??``))&&Po(n,`ground`)})}var Lo=Object.freeze({alpha:.2,color:`#b3aca6`,colorEnd:`#85828c`,size:[.3,.46],sizeEnd:3.4}),Ro=Object.freeze({countPerWidth:8,alpha:.07}),zo=4e3;function Bo(e){return Math.max(e.width,e.depth)>64?zo:1/0}function Vo(e){return!!e&&e.interior===!0}function Ho(e){return!Vo(e)&&e?.border===`forest`}function Uo(e){return!Vo(e)&&e?.outerScenery!==!1}function Wo(e,t){return Vo(e)?`clear`:t}function Go(e){let t=typeof e?.backdrop==`string`?e.backdrop.trim():``;return t===`void`?`#000000`:/^#[0-9a-fA-F]{6}$/.test(t)?t.toLowerCase():null}var Ko=Object.freeze({x:20,y:4.5,z:16});function qo(e){let t=e.width??2;return{count:Math.max(4,Math.round(Ro.countPerWidth*t)),alpha:Ro.alpha,...e.mist??{}}}function Jo(e){return Number.isFinite(e?.scenery?.southGap)?e.scenery.southGap:5}function Yo(e,t,n){let r=[];if(e.godRays===!1||Vo(e))return r;let i=Array.isArray(e.godRayAreas)&&e.godRayAreas.length?e.godRayAreas:[Xo(t,n)];for(let e of i){if(!e||typeof e!=`object`)continue;let t=Math.min(12,Math.max(0,Math.round(e.count??3)));t&&e.maxX>e.minX&&e.maxZ>e.minZ&&r.push({bounds:{minX:e.minX,maxX:e.maxX,minZ:e.minZ,maxZ:e.maxZ,y:Number.isFinite(e.y)?e.y:0},count:t,seed:Number.isFinite(e.seed)?e.seed:7})}return r}function Xo(e,t){let n=lo(e,1),r=new Map;t?.forEachTile((e,t,n)=>{if(!n.walkable||n.water)return;let i=Math.round(n.h*2);r.set(i,(r.get(i)??0)+1)});let i=0,a=-1;for(let[e,t]of r)t>a&&(a=t,i=e/2);let o=Math.max(1,(n.maxX-n.minX)*(n.maxZ-n.minZ));return{...n,y:i,count:Math.max(1,Math.min(6,Math.round(o/90))),seed:7}}function Zo(e){let t=e.environment??{},n=t.foliage&&typeof t.foliage==`object`?t.foliage:{},r=e=>(Array.isArray(e)?e:[]).filter(e=>e&&[`minX`,`maxX`,`minZ`,`maxZ`].every(t=>Number.isFinite(e[t]))),i=r(n.flowerAreas).map(e=>({...e,palette:(Array.isArray(e.palette)?e.palette:[]).filter(e=>Number.isInteger(e)&&e>=0&&e<=3)})).filter(e=>e.palette.length),a=r(n.shrubAreas).filter(e=>Number.isFinite(e.chance)),o=(t,n)=>t>=0&&n>=0&&t<=e.width&&n<=e.depth,s=t=>e.objects.filter(e=>e.type===t);return{trees:s(`tree`).filter(e=>o(e.x,e.z)).map(e=>({x:e.x,z:e.z,r:.3})),clearings:s(`npc`).map(e=>({x:e.x,z:e.z,r:Math.min(8,Math.max(0,Number.isFinite(e.wander)?e.wander:1.2))+.8})),seed:Number.isFinite(n.seed)?n.seed:2024,flowerAreas:i,shrubAreas:a}}function Qo(e){let t=e&&typeof e==`object`?e:{},n=_($o(t.distance,Ye.distance),8,80);return{distance:n,pitch:_($o(t.pitch,Ye.pitch),10,80),minDistance:Math.min(Ye.minDistance,n),maxDistance:Math.max(Ye.maxDistance,n)}}var $o=(e,t)=>Number.isFinite(Number(e))&&e!==null&&e!==``?Number(e):t,es=[`clear`,`rain`,`snow`],ts=.22;function ns(e){let t=Math.exp(-(((e-17.3)/1.3)**2))+.6*Math.exp(-(((e-7)/1)**2));return f(.35,1,_(t))}function rs(e){return{brightness:f(1,.66,e),glint:f(1,.55,e)}}var is=Object.freeze({clear:Object.freeze({sun:1,ambient:1,fog:1,exposure:1,wind:1,windX:1,windZ:.35,temp:0,sat:0,rays:1,dust:1,bugs:1,leaves:1,rain:0,snow:0,overcast:0}),rain:Object.freeze({sun:.26,ambient:.9,fog:2.1,exposure:.92,wind:2.3,windX:2.2,windZ:.9,temp:-.12,sat:-.24,rays:0,dust:.15,bugs:0,leaves:1.6,rain:1,snow:0,overcast:.72}),snow:Object.freeze({sun:.45,ambient:1.15,fog:1.9,exposure:1.04,wind:1.3,windX:1.2,windZ:.5,temp:-.3,sat:-.42,rays:.25,dust:0,bugs:0,leaves:.3,rain:0,snow:1,overcast:.62})}),as=Object.keys(is.clear);function os(e){return typeof e==`string`&&Object.hasOwn(is,e)?e:`clear`}function ss(e){return is[os(e)]}function cs(e){return+(os(e)===`snow`)}var ls={rain:{preset:`rain`,count:2600,bounds:[44,16,44]},snow:{preset:`snow`,count:2400,bounds:[44,15,44],size:[.09,.15]}};function us(e,t={}){let n=ls[e];if(!n)throw Error(`precipitationEmitter: unknown kind "${e}"`);let r={preset:n.preset,...t,count:n.count,bounds:[...n.bounds]};return n.size&&(r.size=[...n.size]),r}function ds(e){return e<.02?0:e}function fs(e,t,{sunMul:n=1,ambientMul:r=1,exposureMul:i=1,pointLightMul:a=1}={}){e.sunMul=n*t.sun,e.ambientMul=r*t.ambient,e.exposureMul=i*t.exposure,e.pointLightMul=a}function ps(e,t=1){R.uWindStrength.value=t*e.wind,R.uWind.value.set(e.windX,e.windZ)}function ms(e,t,n,r){e.temperature=n+t.temp,e.saturation=r+t.sat}var hs=new F(.9,.97,1.12),gs=new F;function _s(e,t){if(t<=0)return e;let n=e.r*.2126+e.g*.7152+e.b*.0722;return gs.copy(hs).multiplyScalar(n),e.lerp(gs,t)}function vs(e,t){t>.002&&(_s(e.fog.color,t),_s(e.sun.color,t*.85),_s(e.hemi.color,t*.6),_s(e.hemi.groundColor,t*.6),R.uFogColor.value.copy(e.fog.color),_s(R.uSunColor.value,t*.85))}function ys(e){return f(.05,.45,e)}function bs(e,t,n){let r=ys(n);for(let t=0;t<e.length;t++)e[t].nightOnly&&(e[t].dayIntensity=r);t&&(t.nightDayIntensity=r)}function xs(e,t){for(let n=0;n<e.length;n++)e[n].day=f(e[n].baseDay,e[n].night*.4,t)}function Ss(e,t){return f(.5,1,_(Math.max(e,t*.8)))}var Cs=Object.freeze({fireflies:1,leaves:1,petals:1,dust:1,smoke:1,mist:1});function ws(e,t,n=Cs,r=0){switch(e){case`fireflies`:return n.fireflies*t.bugs;case`leaves`:return n.leaves*_(t.leaves,0,1)*(1-.6*r);case`petals`:return n.petals*_(1-t.rain-t.snow,0,1);case`dust`:return n.dust*t.dust;case`smoke`:return n.smoke;case`mist`:return n.mist;default:return null}}export{lo as $,Uo as A,uo as B,Go as C,Yo as D,Ho as E,Io as F,mo as G,_o as H,Po as I,yo as J,To as K,jo as L,Jo as M,qo as N,Zo as O,Fo as P,so as Q,ko as R,Lo as S,Bo as T,So as U,wo as V,ho as W,io as X,ro as Y,oo as Z,cs as _,ft as _t,xs as a,Sa as at,zo as b,ms as c,Ki as ct,ws as d,nn as dt,co as et,Ss as f,Fr as ft,ds as g,Lt as gt,us as h,Kr as ht,is as i,qa as it,Wo as j,Vo as k,fs as l,Gi as lt,rs as m,Pr as mt,es as n,Za as nt,bs as o,Zi as ot,ns as p,qr as pt,vo as q,as as r,Da as rt,vs as s,ha as st,ts as t,Ja as tt,ps as u,Pi as ut,ss as v,ot as vt,Qo as w,Ko as x,os as y,Ao as z};