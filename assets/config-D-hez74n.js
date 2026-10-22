import{$i as e,$n as t,$r as n,Aa as r,Ar as i,Bn as a,Ca as o,Ci as s,Cr as c,Dn as l,Dr as u,Ea as d,En as f,Fa as p,Fn as m,Ga as h,Gn as g,Gr as _,Ha as v,Hn as y,Hr as b,Ia as x,In as S,Ja as C,Jn as w,Ka as T,Kr as E,La as D,Ln as O,Lr as k,Ma as A,Na as j,Nn as M,Oa as N,Or as P,Pa as F,Pr as I,Qn as L,Qr as R,Ra as ee,Rr as te,Sa as ne,Si as re,Sn as ie,Sr as z,Ta as B,Tn as ae,Tr as oe,Ua as se,Ur as V,Va as ce,Vn as le,Vr as ue,Wa as H,Wn as de,Wr as fe,Xa as U,Xn as pe,Xr as W,Ya as me,Za as he,Zr as ge,_i as _e,_n as ve,aa as ye,ai as be,ar as G,ba as xe,bn as Se,br as Ce,ci as we,cr as Te,di as Ee,dr as De,ea as Oe,ei as ke,er as Ae,fr as je,ga as Me,gr as K,hi as Ne,hr as Pe,ii as Fe,ir as q,ja as Ie,kn as Le,li as J,lr as Y,ma as Re,mr as ze,ni as Be,oa as Ve,oi as He,or as Ue,pa as We,pi as Ge,qa as Ke,qn as qe,qr as Je,ri as Ye,sa as Xe,sr as Ze,ta as Qe,ti as $e,ui as et,ur as tt,vn as nt,wa as rt,xn as it,xr as at,yr as ot,za as st,zn as ct}from"./LevelStorage-BIxTLbPi.js";function lt(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function ut(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var X={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Z={common:{diffuse:{value:new G(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new W},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new W}},envmap:{envMap:{value:null},envMapRotation:{value:new W},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new W}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new W}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new W},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new W},normalScale:{value:new F(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new W},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new W}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new W}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new W}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new G(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new p},probesMax:{value:new p},probesResolution:{value:new p}},points:{diffuse:{value:new G(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0},uvTransform:{value:new W}},sprite:{diffuse:{value:new G(16777215)},opacity:{value:1},center:{value:new F(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new W},alphaMap:{value:null},alphaMapTransform:{value:new W},alphaTest:{value:0}}},dt={basic:{uniforms:C([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.fog]),vertexShader:X.meshbasic_vert,fragmentShader:X.meshbasic_frag},lambert:{uniforms:C([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new G(0)},envMapIntensity:{value:1}}]),vertexShader:X.meshlambert_vert,fragmentShader:X.meshlambert_frag},phong:{uniforms:C([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new G(0)},specular:{value:new G(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:X.meshphong_vert,fragmentShader:X.meshphong_frag},standard:{uniforms:C([Z.common,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.roughnessmap,Z.metalnessmap,Z.fog,Z.lights,{emissive:{value:new G(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag},toon:{uniforms:C([Z.common,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.gradientmap,Z.fog,Z.lights,{emissive:{value:new G(0)}}]),vertexShader:X.meshtoon_vert,fragmentShader:X.meshtoon_frag},matcap:{uniforms:C([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,{matcap:{value:null}}]),vertexShader:X.meshmatcap_vert,fragmentShader:X.meshmatcap_frag},points:{uniforms:C([Z.points,Z.fog]),vertexShader:X.points_vert,fragmentShader:X.points_frag},dashed:{uniforms:C([Z.common,Z.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:X.linedashed_vert,fragmentShader:X.linedashed_frag},depth:{uniforms:C([Z.common,Z.displacementmap]),vertexShader:X.depth_vert,fragmentShader:X.depth_frag},normal:{uniforms:C([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,{opacity:{value:1}}]),vertexShader:X.meshnormal_vert,fragmentShader:X.meshnormal_frag},sprite:{uniforms:C([Z.sprite,Z.fog]),vertexShader:X.sprite_vert,fragmentShader:X.sprite_frag},background:{uniforms:{uvTransform:{value:new W},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:X.background_vert,fragmentShader:X.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new W}},vertexShader:X.backgroundCube_vert,fragmentShader:X.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:X.cube_vert,fragmentShader:X.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:X.equirect_vert,fragmentShader:X.equirect_frag},distance:{uniforms:C([Z.common,Z.displacementmap,{referencePosition:{value:new p},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:X.distance_vert,fragmentShader:X.distance_frag},shadow:{uniforms:C([Z.lights,Z.fog,{color:{value:new G(0)},opacity:{value:1}}]),vertexShader:X.shadow_vert,fragmentShader:X.shadow_frag}};dt.physical={uniforms:C([dt.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new W},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new W},clearcoatNormalScale:{value:new F(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new W},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new W},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new W},sheen:{value:0},sheenColor:{value:new G(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new W},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new W},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new W},transmissionSamplerSize:{value:new F},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new W},attenuationDistance:{value:0},attenuationColor:{value:new G(0)},specularColor:{value:new G(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new W},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new W},anisotropyVector:{value:new F},anisotropyMap:{value:null},anisotropyMapTransform:{value:new W}}]),vertexShader:X.meshphysical_vert,fragmentShader:X.meshphysical_frag};var ft={r:0,b:0,g:0},pt=new ge,mt=new W;mt.set(-1,0,0,0,1,0,0,0,1);function ht(e,t,n,r,i,a){let o=new G(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new R(new L(1,1,1),new Me({name:`BackgroundCubeMaterial`,uniforms:ce(dt.backgroundCube.uniforms),vertexShader:dt.backgroundCube.vertexShader,fragmentShader:dt.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(pt.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(mt),l.material.toneMapped=Ue.getTransfer(i.colorSpace)!==Re,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new R(new Ee(2,2),new Me({name:`BackgroundMaterial`,uniforms:ce(dt.background.uniforms),vertexShader:dt.background.vertexShader,fragmentShader:dt.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Ue.getTransfer(i.colorSpace)!==Re,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(ft,T(e)),n.buffers.color.setClear(ft.r,ft.g,ft.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function gt(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function _t(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function vt(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return t===1023||r.convert(t)===e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT)}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(U(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&U(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function yt(e){let t=this,n=null,r=0,i=!1,a=!1,o=new et,s=new W,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var bt=4,xt=6,St=20,Ct=256,wt=new we,Tt=new G,Et=null,Dt=0,Ot=0,kt=!1,At=new p,jt=new p,Mt=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=At}=i;Et=this._renderer.getRenderTarget(),Dt=this._renderer.getActiveCubeFace(),Ot=this._renderer.getActiveMipmapLevel(),kt=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=zt(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Rt(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Et,Dt,Ot),this._renderer.xr.enabled=kt,e.scissorTest=!1,Ft(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Et=this._renderer.getRenderTarget(),Dt=this._renderer.getActiveCubeFace(),Ot=this._renderer.getActiveMipmapLevel(),kt=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:V,minFilter:V,generateMipmaps:!1,type:P,format:re,colorSpace:E,depthBuffer:!1},r=Pt(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Pt(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Nt(r)),this._blurMaterial=Lt(r,e,t),this._ggxMaterial=It(r,e,t)}return r}_compileMaterial(e){let t=new R(new Ae,e);this._renderer.compile(t,wt)}_sceneToCubeUV(e,t,r,i,a){let o=new J(90,1,t,r),s=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],l=this._renderer,u=l.autoClear,d=l.toneMapping;l.getClearColor(Tt),l.toneMapping=0,l.autoClear=!1,l.state.buffers.depth.getReversed()&&(l.setRenderTarget(i),l.clearDepth(),l.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new R(new L,new n({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let f=this._backgroundBox,p=f.material,m=!1,h=e.background;h?h.isColor&&(p.color.copy(h),e.background=null,m=!0):(p.color.copy(Tt),m=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(o.up.set(0,s[t],0),o.position.set(a.x,a.y,a.z),o.lookAt(a.x+c[t],a.y,a.z)):n===1?(o.up.set(0,0,s[t]),o.position.set(a.x,a.y,a.z),o.lookAt(a.x,a.y+c[t],a.z)):(o.up.set(0,s[t],0),o.position.set(a.x,a.y,a.z),o.lookAt(a.x,a.y,a.z+c[t]));let r=this._cubeSize;Ft(i,n*r,t>2?r:0,r,r),l.setRenderTarget(i),m&&l.render(f,o),l.render(e,o)}l.toneMapping=d,l.autoClear=u,e.background=h}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=zt()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Rt());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;Ft(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,wt)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-bt?n-d+bt:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,Ft(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,wt),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,Ft(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,wt)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];Ft(t,3*l*(r>this._lodMax-bt?r-this._lodMax+bt:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,wt)}};function Nt(e){let n=[],r=[],i=e,a=e-bt+1+xt;for(let e=0;e<a;e++){let e=2**i;n.push(e);let a=1/(e-2),o=-a,s=1+a,c=[o,o,s,o,s,s,o,o,s,s,o,s],l=new Float32Array(108),u=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];l.set(r,18*e);for(let t=0;t<6;t++){let n=c[t*2]*2-1,r=c[t*2+1]*2-1;e===0?jt.set(1,r,n):e===1?jt.set(-n,1,-r):e===2?jt.set(-n,r,1):e===3?jt.set(-1,r,-n):e===4?jt.set(-n,-1,r):jt.set(n,r,-1),jt.toArray(u,(e*6+t)*3)}}let d=new Ae;d.setAttribute(`position`,new t(l,3)),d.setAttribute(`outputDirection`,new t(u,3)),r.push(new R(d,null)),i>bt&&i--}return{lodMeshes:r,sizeLods:n}}function Pt(e,t,n){let r=new ee(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function Ft(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function It(e,t,n){return new Me({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:Ct,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Bt(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Lt(e,t,n){return new Me({name:`SphericalGaussianBlur`,defines:{SAMPLES:St,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Bt(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Rt(){return new Me({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Bt(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function zt(){return new Me({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Bt(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Bt(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Vt=class extends ee{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Y(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new L(5,5,5),i=new Me({name:`CubemapFromEquirect`,uniforms:ce(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new R(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=V),new Ze(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Ht(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304){if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}{let r=n.image;if(r&&r.height>0){let i=new Vt(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}return null}}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Mt(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Mt(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function Ut(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&he(`WebGLRenderer: `+e+` extension not supported.`),t}}}function Wt(e,t,n,r){let i={},a=new WeakMap;function s(e){let o=e.target;o.index!==null&&t.remove(o.index);for(let e in o.attributes)t.remove(o.attributes[e]);o.removeEventListener(`dispose`,s),delete i[o.id];let c=a.get(o);c&&(t.remove(c),a.delete(o)),r.releaseStatesOfGeometry(o),o.isInstancedBufferGeometry===!0&&delete o._maxInstanceCount,n.memory.geometries--}function c(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,s),i[t.id]=!0,n.memory.geometries++,t)}function l(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function u(e){let n=[],r=e.index,i=e.attributes.position,s=0;if(i===void 0)return;if(r!==null){let e=r.array;s=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;s=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let c=new(i.count>=65535?rt:o)(n,1);c.version=s;let l=a.get(e);l&&t.remove(l),a.set(e,c)}function d(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&u(e)}else u(e);return a.get(e)}return{get:c,update:l,getWireframeAttribute:d}}function Gt(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function Kt(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:H(`WebGLInfo: Unknown draw mode:`,r)}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function qt(e,t,n){let r=new WeakMap,i=new x;function a(a,o,s){let l=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=u===void 0?0:u.length,f=r.get(o);if(f===void 0||f.count!==d){f!==void 0&&f.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],l=o.morphAttributes.normal||[],u=o.morphAttributes.color||[],p=0;e===!0&&(p=1),n===!0&&(p=2),a===!0&&(p=3);let m=o.attributes.position.count*p,h=1;m>t.maxTextureSize&&(h=Math.ceil(m/t.maxTextureSize),m=t.maxTextureSize);let g=new Float32Array(m*h*4*d),_=new De(g,m,h,d);_.type=c,_.needsUpdate=!0;let v=p*4;for(let t=0;t<d;t++){let r=s[t],o=l[t],c=u[t],d=m*h*4*t;for(let t=0;t<r.count;t++){let s=t*v;e===!0&&(i.fromBufferAttribute(r,t),g[d+s+0]=i.x,g[d+s+1]=i.y,g[d+s+2]=i.z,g[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),g[d+s+4]=i.x,g[d+s+5]=i.y,g[d+s+6]=i.z,g[d+s+7]=0),a===!0&&(i.fromBufferAttribute(c,t),g[d+s+8]=i.x,g[d+s+9]=i.y,g[d+s+10]=i.z,g[d+s+11]=c.itemSize===4?i.w:1)}}f={count:d,texture:_,size:new F(m,h)},r.set(o,f);function y(){_.dispose(),r.delete(o),o.removeEventListener(`dispose`,y)}o.addEventListener(`dispose`,y)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<l.length;e++)t+=l[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,l)}s.getUniforms().setValue(e,`morphTargetsTexture`,f.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,f.size)}return{update:a}}function Jt(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Yt={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Xt(e,t,n,r,i,a){let o=new ee(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new Ae;l.setAttribute(`position`,new z([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new z([0,2,0,0,2,0],2));let u=new Qe({uniforms:{tDiffuse:{value:null}},vertexShader:`
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

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

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

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new R(l,u),f=new we(-1,1,1,-1,0,1),p=null,m=null,h=!1,g,_=null,v=[],y=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<v.length;n++){let r=v[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){v=e,y=v.length>0&&v[0].isRenderPass===!0;let t=o.width,n=o.height;v.length>0&&s===null&&(s=new ee(t,n,{type:P,depthBuffer:!1,stencilBuffer:!1}),c=new ee(t,n,{type:P,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<v.length;e++){let r=v[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(h||e.toneMapping===0&&v.length===0)return!1;if(_=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return y===!1&&e.setRenderTarget(o),g=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return y},this.end=function(e,t){e.toneMapping=g,h=!0;let n=o,r=s;for(let i=0;i<v.length;i++){let a=v[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||m!==e.toneMapping){p=e.outputColorSpace,m=e.toneMapping,u.defines={},Ue.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=Yt[m];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(_),e.render(d,f),_=null,h=!1},this.isCompositing=function(){return h},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var Zt=new ne,Qt=new K(1,1),$t=new De,en=new tt,tn=new Y,nn=[],rn=[],an=new Float32Array(16),on=new Float32Array(9),sn=new Float32Array(4);function cn(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=nn[i];if(a===void 0&&(a=new Float32Array(i),nn[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function ln(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function un(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function dn(e,t){let n=rn[t];n===void 0&&(n=new Int32Array(t),rn[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function fn(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function pn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ln(n,t))return;e.uniform2fv(this.addr,t),un(n,t)}}function mn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(ln(n,t))return;e.uniform3fv(this.addr,t),un(n,t)}}function hn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ln(n,t))return;e.uniform4fv(this.addr,t),un(n,t)}}function gn(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ln(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),un(n,t)}else{if(ln(n,r))return;sn.set(r),e.uniformMatrix2fv(this.addr,!1,sn),un(n,r)}}function _n(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ln(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),un(n,t)}else{if(ln(n,r))return;on.set(r),e.uniformMatrix3fv(this.addr,!1,on),un(n,r)}}function vn(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ln(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),un(n,t)}else{if(ln(n,r))return;an.set(r),e.uniformMatrix4fv(this.addr,!1,an),un(n,r)}}function yn(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function bn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ln(n,t))return;e.uniform2iv(this.addr,t),un(n,t)}}function xn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ln(n,t))return;e.uniform3iv(this.addr,t),un(n,t)}}function Sn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ln(n,t))return;e.uniform4iv(this.addr,t),un(n,t)}}function Cn(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function wn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ln(n,t))return;e.uniform2uiv(this.addr,t),un(n,t)}}function Tn(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ln(n,t))return;e.uniform3uiv(this.addr,t),un(n,t)}}function En(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ln(n,t))return;e.uniform4uiv(this.addr,t),un(n,t)}}function Dn(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(Qt.compareFunction=n.isReversedDepthBuffer()?518:515,a=Qt):a=Zt,n.setTexture2D(t||a,i)}function On(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||en,i)}function kn(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||tn,i)}function An(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||$t,i)}function jn(e){switch(e){case 5126:return fn;case 35664:return pn;case 35665:return mn;case 35666:return hn;case 35674:return gn;case 35675:return _n;case 35676:return vn;case 5124:case 35670:return yn;case 35667:case 35671:return bn;case 35668:case 35672:return xn;case 35669:case 35673:return Sn;case 5125:return Cn;case 36294:return wn;case 36295:return Tn;case 36296:return En;case 35678:case 36198:case 36298:case 36306:case 35682:return Dn;case 35679:case 36299:case 36307:return On;case 35680:case 36300:case 36308:case 36293:return kn;case 36289:case 36303:case 36311:case 36292:return An}}function Mn(e,t){e.uniform1fv(this.addr,t)}function Nn(e,t){let n=cn(t,this.size,2);e.uniform2fv(this.addr,n)}function Pn(e,t){let n=cn(t,this.size,3);e.uniform3fv(this.addr,n)}function Fn(e,t){let n=cn(t,this.size,4);e.uniform4fv(this.addr,n)}function In(e,t){let n=cn(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Ln(e,t){let n=cn(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Rn(e,t){let n=cn(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function zn(e,t){e.uniform1iv(this.addr,t)}function Bn(e,t){e.uniform2iv(this.addr,t)}function Vn(e,t){e.uniform3iv(this.addr,t)}function Hn(e,t){e.uniform4iv(this.addr,t)}function Un(e,t){e.uniform1uiv(this.addr,t)}function Wn(e,t){e.uniform2uiv(this.addr,t)}function Gn(e,t){e.uniform3uiv(this.addr,t)}function Kn(e,t){e.uniform4uiv(this.addr,t)}function qn(e,t,n){let r=this.cache,i=t.length,a=dn(n,i);ln(r,a)||(e.uniform1iv(this.addr,a),un(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?Qt:Zt;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Jn(e,t,n){let r=this.cache,i=t.length,a=dn(n,i);ln(r,a)||(e.uniform1iv(this.addr,a),un(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||en,a[e])}function Yn(e,t,n){let r=this.cache,i=t.length,a=dn(n,i);ln(r,a)||(e.uniform1iv(this.addr,a),un(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||tn,a[e])}function Xn(e,t,n){let r=this.cache,i=t.length,a=dn(n,i);ln(r,a)||(e.uniform1iv(this.addr,a),un(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||$t,a[e])}function Zn(e){switch(e){case 5126:return Mn;case 35664:return Nn;case 35665:return Pn;case 35666:return Fn;case 35674:return In;case 35675:return Ln;case 35676:return Rn;case 5124:case 35670:return zn;case 35667:case 35671:return Bn;case 35668:case 35672:return Vn;case 35669:case 35673:return Hn;case 5125:return Un;case 36294:return Wn;case 36295:return Gn;case 36296:return Kn;case 35678:case 36198:case 36298:case 36306:case 35682:return qn;case 35679:case 36299:case 36307:return Jn;case 35680:case 36300:case 36308:case 36293:return Yn;case 36289:case 36303:case 36311:case 36292:return Xn}}var Qn=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=jn(t.type)}},$n=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Zn(t.type)}},er=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},tr=/(\w+)(\])?(\[|\.)?/g;function nr(e,t){e.seq.push(t),e.map[t.id]=t}function rr(e,t,n){let r=e.name,i=r.length;for(tr.lastIndex=0;;){let a=tr.exec(r),o=tr.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){nr(n,l===void 0?new Qn(s,e,t):new $n(s,e,t));break}{let e=n.map[s];e===void 0&&(e=new er(s),nr(n,e)),n=e}}}var ir=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);rr(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function ar(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var or=37297,sr=0;function cr(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var lr=new W;function ur(e){Ue._getMatrix(lr,Ue.workingColorSpace,e);let t=`mat3( ${lr.elements.map(e=>e.toFixed(4))} )`;switch(Ue.getTransfer(e)){case Je:return[t,`LinearTransferOETF`];case Re:return[t,`sRGBTransferOETF`];default:return U(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function dr(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+cr(e.getShaderSource(t),r)}return i}function fr(e,t){let n=ur(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var pr={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function mr(e,t){let n=pr[t];return n===void 0?(U(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var hr=new p;function gr(){return Ue.getLuminanceCoefficients(hr),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${hr.x.toFixed(4)}, ${hr.y.toFixed(4)}, ${hr.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function _r(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(br).join(`
`)}function vr(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function yr(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function br(e){return e!==``}function xr(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Sr(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Cr=/^[ \t]*#include +<([\w\d./]+)>/gm;function wr(e){return e.replace(Cr,Er)}var Tr=new Map;function Er(e,t){let n=X[t];if(n===void 0){let e=Tr.get(t);if(e!==void 0)n=X[e],U(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return wr(n)}var Dr=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Or(e){return e.replace(Dr,kr)}function kr(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Ar(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var jr={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function Mr(e){return jr[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Nr={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function Pr(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Nr[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var Fr={302:`ENVMAP_MODE_REFRACTION`};function Ir(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:Fr[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var Lr={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Rr(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:Lr[e.combine]||`ENVMAP_BLENDING_NONE`}function zr(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Br(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=Mr(n),l=Pr(n),u=Ir(n),d=Rr(n),f=zr(n),p=_r(n),m=vr(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(br).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(br).join(`
`),_.length>0&&(_+=`
`)):(g=[Ar(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(br).join(`
`),_=[Ar(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:X.tonemapping_pars_fragment,n.toneMapping===0?``:mr(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,X.colorspace_pars_fragment,fr(`linearToOutputTexel`,n.outputColorSpace),gr(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(br).join(`
`)),o=wr(o),o=xr(o,n),o=Sr(o,n),s=wr(s),s=xr(s,n),s=Sr(s,n),o=Or(o),s=Or(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=ar(i,i.VERTEX_SHADER,y),S=ar(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1){if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=dr(i,x,`vertex`),n=dr(i,S,`fragment`);H(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}}else o===``?(s===``||c===``)&&(u=!1):U(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new ir(i,h),T=yr(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,or)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=sr++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Vr=0,Hr=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Ur(e),t.set(e,n)),n}},Ur=class{constructor(e){this.id=Vr++,this.code=e,this.usedTimes=0}};function Wr(e){return e===1030||e===37490||e===36285}function Gr(e,t,n,r,i,a){let o=new k,s=new Hr,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&U(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=dt[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let j=e.getRenderTarget(),M=e.state.buffers.depth.getReversed(),N=h.isInstancedMesh===!0,P=h.isBatchedMesh===!0,F=!!i.map,I=!!i.matcap,L=!!x,R=!!i.aoMap,ee=!!i.lightMap,te=!!i.bumpMap&&i.wireframe===!1,ne=!!i.normalMap,re=!!i.displacementMap,ie=!!i.emissiveMap,z=!!i.metalnessMap,B=!!i.roughnessMap,ae=i.anisotropy>0,oe=i.clearcoat>0,se=i.dispersion>0,V=i.retroreflectivity>0,ce=i.iridescence>0,le=i.sheen>0,ue=i.transmission>0,H=ae&&!!i.anisotropyMap,de=oe&&!!i.clearcoatMap,fe=oe&&!!i.clearcoatNormalMap,pe=oe&&!!i.clearcoatRoughnessMap,W=ce&&!!i.iridescenceMap,me=ce&&!!i.iridescenceThicknessMap,he=le&&!!i.sheenColorMap,ge=le&&!!i.sheenRoughnessMap,_e=!!i.specularMap,ve=!!i.specularColorMap,ye=!!i.specularIntensityMap,be=ue&&!!i.transmissionMap,G=ue&&!!i.thicknessMap,xe=!!i.gradientMap,Se=!!i.alphaMap,Ce=i.alphaTest>0,we=!!i.alphaHash,Te=!!i.extensions,Ee=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Ee=e.toneMapping);let De={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:P,batchingColor:P&&h._colorsTexture!==null,instancing:N,instancingColor:N&&h.instanceColor!==null,instancingMorph:N&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Ue.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:F,matcap:I,envMap:L,envMapMode:L&&x.mapping,envMapCubeUVHeight:S,aoMap:R,lightMap:ee,bumpMap:te,normalMap:ne,displacementMap:re,emissiveMap:ie,normalMapObjectSpace:ne&&i.normalMapType===1,normalMapTangentSpace:ne&&i.normalMapType===0,packedNormalMap:ne&&i.normalMapType===0&&Wr(i.normalMap.format),metalnessMap:z,roughnessMap:B,anisotropy:ae,anisotropyMap:H,clearcoat:oe,clearcoatMap:de,clearcoatNormalMap:fe,clearcoatRoughnessMap:pe,dispersion:se,retroreflection:V,iridescence:ce,iridescenceMap:W,iridescenceThicknessMap:me,sheen:le,sheenColorMap:he,sheenRoughnessMap:ge,specularMap:_e,specularColorMap:ve,specularIntensityMap:ye,transmission:ue,transmissionMap:be,thicknessMap:G,gradientMap:xe,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Se,alphaTest:Ce,alphaHash:we,combine:i.combine,mapUv:F&&m(i.map.channel),aoMapUv:R&&m(i.aoMap.channel),lightMapUv:ee&&m(i.lightMap.channel),bumpMapUv:te&&m(i.bumpMap.channel),normalMapUv:ne&&m(i.normalMap.channel),displacementMapUv:re&&m(i.displacementMap.channel),emissiveMapUv:ie&&m(i.emissiveMap.channel),metalnessMapUv:z&&m(i.metalnessMap.channel),roughnessMapUv:B&&m(i.roughnessMap.channel),anisotropyMapUv:H&&m(i.anisotropyMap.channel),clearcoatMapUv:de&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:fe&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:pe&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:W&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:me&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:he&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:ge&&m(i.sheenRoughnessMap.channel),specularMapUv:_e&&m(i.specularMap.channel),specularColorMapUv:ve&&m(i.specularColorMap.channel),specularIntensityMapUv:ye&&m(i.specularIntensityMap.channel),transmissionMapUv:be&&m(i.transmissionMap.channel),thicknessMapUv:G&&m(i.thicknessMap.channel),alphaMapUv:Se&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(ne||ae),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(F||Se),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&ne===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:M,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:Ee,decodeVideoTexture:F&&i.map.isVideoTexture===!0&&Ue.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:ie&&i.emissiveMap.isVideoTexture===!0&&Ue.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:Te&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(Te&&i.extensions.multiDraw===!0||P)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return De.vertexUv1s=c.has(1),De.vertexUv2s=c.has(2),De.vertexUv3s=c.has(3),c.clear(),De}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=dt[t];n=B.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new Br(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function Kr(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function qr(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Jr(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Yr(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||qr),r.length>1&&r.sort(t||Jr),i.length>1&&i.sort(t||Jr)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function Xr(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Yr,e.set(t,[i])):n>=r.length?(i=new Yr,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Zr(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new p,color:new G};break;case`SpotLight`:n={position:new p,direction:new p,color:new G,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new p,color:new G,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new p,skyColor:new G,groundColor:new G};break;case`RectAreaLight`:n={color:new G,position:new p,halfWidth:new p,halfHeight:new p}}return e[t.id]=n,n}}}function Qr(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new F};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new F};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new F,shadowCameraNear:1,shadowCameraFar:1e3}}return e[t.id]=n,n}}}var $r=0;function ei(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function ti(e){let t=new Zr,n=Qr(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new p);let i=new p,a=new ge,o=new ge;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(ei);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Z.LTC_FLOAT_1,r.rectAreaLTC2=Z.LTC_FLOAT_2):(r.rectAreaLTC1=Z.LTC_HALF_1,r.rectAreaLTC2=Z.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=$r++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function ni(e){let t=new ti(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function ri(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new ni(e),t.set(n,[a])):r>=i.length?(a=new ni(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var ii=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ai=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,oi=[new p(1,0,0),new p(-1,0,0),new p(0,1,0),new p(0,-1,0),new p(0,0,1),new p(0,0,-1)],si=[new p(0,-1,0),new p(0,-1,0),new p(0,0,1),new p(0,0,-1),new p(0,-1,0),new p(0,-1,0)],ci=new ge,li=new p,ui=new p;function di(n,i,a){let o=new oe,s=new F,l=new F,u=new x,d=new ke,f=new $e,p={},m=a.maxTextureSize,h={0:1,1:0,2:2},g=new Me({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new F},radius:{value:4}},vertexShader:ii,fragmentShader:ai}),_=g.clone();_.defines.HORIZONTAL_PASS=1;let v=new Ae;v.setAttribute(`position`,new t(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new R(v,g),b=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let S=this.type;this.render=function(t,i,a){if(b.enabled===!1||b.autoUpdate===!1&&b.needsUpdate===!1||t.length===0)return;this.type===2&&(U(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let d=n.getRenderTarget(),f=n.getActiveCubeFace(),p=n.getActiveMipmapLevel(),h=n.state;h.setBlending(0),h.buffers.depth.getReversed()===!0?h.buffers.color.setClear(0,0,0,0):h.buffers.color.setClear(1,1,1,1),h.buffers.depth.setTest(!0),h.setScissorTest(!1);let g=S!==this.type;g&&i.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let d=0,f=t.length;d<f;d++){let f=t[d],p=f.shadow;if(p===void 0){U(`WebGLShadowMap:`,f,`has no shadow.`);continue}if(p.autoUpdate===!1&&p.needsUpdate===!1)continue;s.copy(p.mapSize);let _=p.getFrameExtents();s.multiply(_),l.copy(p.mapSize),(s.x>m||s.y>m)&&(s.x>m&&(l.x=Math.floor(m/_.x),s.x=l.x*_.x,p.mapSize.x=l.x),s.y>m&&(l.y=Math.floor(m/_.y),s.y=l.y*_.y,p.mapSize.y=l.y));let v=n.state.buffers.depth.getReversed();if(p.camera._reversedDepth=v,p.map===null||g===!0){if(p.map!==null&&(p.map.depthTexture!==null&&(p.map.depthTexture.dispose(),p.map.depthTexture=null),p.map.dispose()),this.type===3){if(f.isPointLight){U(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}p.map=new ee(s.x,s.y,{format:e,type:P,minFilter:V,magFilter:V,generateMipmaps:!1}),p.map.texture.name=f.name+`.shadowMap`,p.map.depthTexture=new K(s.x,s.y,c),p.map.depthTexture.name=f.name+`.shadowMapDepth`,p.map.depthTexture.format=ze,p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=Fe,p.map.depthTexture.magFilter=Fe}else f.isPointLight?(p.map=new Vt(s.x),p.map.depthTexture=new Te(s.x,r)):(p.map=new ee(s.x,s.y),p.map.depthTexture=new K(s.x,s.y,r)),p.map.depthTexture.name=f.name+`.shadowMap`,p.map.depthTexture.format=ze,this.type===1?(p.map.depthTexture.compareFunction=v?518:515,p.map.depthTexture.minFilter=V,p.map.depthTexture.magFilter=V):(p.map.depthTexture.compareFunction=null,p.map.depthTexture.minFilter=Fe,p.map.depthTexture.magFilter=Fe);p.camera.updateProjectionMatrix()}p.map.isWebGLCubeRenderTarget!==!0&&(p.map.width!==s.x||p.map.height!==s.y)&&p.map.setSize(s.x,s.y);let y=p.map.isWebGLCubeRenderTarget?6:p.getViewportCount();f.isPointLight!==!0&&p.updateMatrices(f,a);for(let e=0;e<y;e++){let t=p.getCamera(e);if(f.isPointLight){let t=p.camera,n=p.matrix,r=f.distance||t.far;r!==t.far&&(t.far=r,t.updateProjectionMatrix()),li.setFromMatrixPosition(f.matrixWorld),t.position.copy(li),ui.copy(t.position),ui.add(oi[e]),t.up.copy(si[e]),t.lookAt(ui),t.updateMatrixWorld(),n.makeTranslation(-li.x,-li.y,-li.z),ci.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),p._frustum.setFromProjectionMatrix(ci,t.coordinateSystem,t.reversedDepth)}if(p.map.isWebGLCubeRenderTarget)n.setRenderTarget(p.map,e),n.clear();else{e===0&&(n.setRenderTarget(p.map),n.clear());let t=p.getViewport(e);u.set(l.x*t.x,l.y*t.y,l.x*t.z,l.y*t.w),h.viewport(u)}o=p.getFrustum(e),T(i,a,t,f,this.type)}p.isPointLightShadow!==!0&&this.type===3&&C(p,a),p.needsUpdate=!1}S=this.type,b.needsUpdate=!1,n.setRenderTarget(d,f,p)};function C(t,r){let a=i.update(y);g.defines.VSM_SAMPLES!==t.blurSamples&&(g.defines.VSM_SAMPLES=t.blurSamples,_.defines.VSM_SAMPLES=t.blurSamples,g.needsUpdate=!0,_.needsUpdate=!0),t.mapPass===null?t.mapPass=new ee(s.x,s.y,{format:e,type:P}):(t.mapPass.width!==t.map.width||t.mapPass.height!==t.map.height)&&t.mapPass.setSize(t.map.width,t.map.height),g.uniforms.shadow_pass.value=t.map.depthTexture,g.uniforms.resolution.value.set(t.map.width,t.map.height),g.uniforms.radius.value=t.radius,n.setRenderTarget(t.mapPass),n.clear(),n.renderBufferDirect(r,null,a,g,y,null),_.uniforms.shadow_pass.value=t.mapPass.texture,_.uniforms.resolution.value.set(t.map.width,t.map.height),_.uniforms.radius.value=t.radius,n.setRenderTarget(t.map),n.clear(),n.renderBufferDirect(r,null,a,_,y,null)}function w(e,t,r,i){let a=null,o=r.isPointLight===!0?e.customDistanceMaterial:e.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?f:d,n.localClippingEnabled&&t.clipShadows===!0&&Array.isArray(t.clippingPlanes)&&t.clippingPlanes.length!==0||t.displacementMap&&t.displacementScale!==0||t.alphaMap&&t.alphaTest>0||t.map&&t.alphaTest>0||t.alphaToCoverage===!0){let e=a.uuid,n=t.uuid,r=p[e];r===void 0&&(r={},p[e]=r);let i=r[n];i===void 0&&(i=a.clone(),r[n]=i,t.addEventListener(`dispose`,E)),a=i}if(a.visible=t.visible,a.wireframe=t.wireframe,i===3?a.side=t.shadowSide===null?t.side:t.shadowSide:a.side=t.shadowSide===null?h[t.side]:t.shadowSide,a.alphaMap=t.alphaMap,a.alphaTest=t.alphaToCoverage===!0?.5:t.alphaTest,a.map=t.map,a.clipShadows=t.clipShadows,a.clippingPlanes=t.clippingPlanes,a.clipIntersection=t.clipIntersection,a.displacementMap=t.displacementMap,a.displacementScale=t.displacementScale,a.displacementBias=t.displacementBias,a.wireframeLinewidth=t.wireframeLinewidth,a.linewidth=t.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let e=n.properties.get(a);e.light=r}return a}function T(e,t,r,a,s){if(e.visible===!1)return;if(e.layers.test(t.layers)&&(e.isMesh||e.isLine||e.isPoints)&&(e.castShadow||e.receiveShadow&&s===3)&&(!e.frustumCulled||e.intersectsFrustum(o))){e.modelViewMatrix.multiplyMatrices(r.matrixWorldInverse,e.matrixWorld);let o=i.update(e),c=e.material;if(Array.isArray(c)){let i=o.groups;for(let l=0,u=i.length;l<u;l++){let u=i[l],d=c[u.materialIndex];if(d&&d.visible){let i=w(e,d,a,s);e.onBeforeShadow(n,e,t,r,o,i,u),n.renderBufferDirect(r,null,o,i,e,u),e.onAfterShadow(n,e,t,r,o,i,u)}}}else if(c.visible){let i=w(e,c,a,s);e.onBeforeShadow(n,e,t,r,o,i,null),n.renderBufferDirect(r,null,o,i,e,null),e.onAfterShadow(n,e,t,r,o,i,null)}}let c=e.children;for(let e=0,n=c.length;e<n;e++)T(c[e],t,r,a,s)}function E(e){e.target.removeEventListener(`dispose`,E);for(let t in p){let n=p[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function fi(e,t){function n(){let t=!1,n=new x,r=null,i=new x(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?B(e.DEPTH_TEST):ae(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=Xe[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?B(e.STENCIL_TEST):ae(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,S=null,C=null,w=null,T=new G(0,0,0),E=0,D=!1,O=null,k=null,A=null,j=null,M=null,N=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),P=!1,F=0,I=e.getParameter(e.VERSION);I.indexOf(`WebGL`)===-1?I.indexOf(`OpenGL ES`)!==-1&&(F=parseFloat(/^OpenGL ES (\d)/.exec(I)[1]),P=F>=2):(F=parseFloat(/^WebGL (\d)/.exec(I)[1]),P=F>=1);let L=null,R={},ee=e.getParameter(e.SCISSOR_BOX),te=e.getParameter(e.VIEWPORT),ne=new x().fromArray(ee),re=new x().fromArray(te);function ie(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let z={};z[e.TEXTURE_2D]=ie(e.TEXTURE_2D,e.TEXTURE_2D,1),z[e.TEXTURE_CUBE_MAP]=ie(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),z[e.TEXTURE_2D_ARRAY]=ie(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),z[e.TEXTURE_3D]=ie(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),B(e.DEPTH_TEST),o.setFunc(3),fe(!1),U(1),B(e.CULL_FACE),ue(0);function B(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function ae(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function oe(t,n){return f[t]!==n&&(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function se(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function V(t){return h!==t&&(e.useProgram(t),h=t,!0)}let ce={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};ce[103]=e.MIN,ce[104]=e.MAX;let le={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function ue(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(ae(e.BLEND),g=!1);return}if(g===!1&&(B(e.BLEND),g=!0),t!==5){if(t!==_||u!==D){if((v!==100||S!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,S=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:H(`WebGLState: Invalid blending: `,t)}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:H(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:H(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:H(`WebGLState: Invalid blending: `,t)}y=null,b=null,C=null,w=null,T.set(0,0,0),E=0,_=t,D=u}return}a||=n,o||=r,s||=i,(n!==v||a!==S)&&(e.blendEquationSeparate(ce[n],ce[a]),v=n,S=a),(r!==y||i!==b||o!==C||s!==w)&&(e.blendFuncSeparate(le[r],le[i],le[o],le[s]),y=r,b=i,C=o,w=s),(c.equals(T)===!1||l!==E)&&(e.blendColor(c.r,c.g,c.b,l),T.copy(c),E=l),_=t,D=!1}function de(t,n){t.side===2?ae(e.CULL_FACE):B(e.CULL_FACE);let r=t.side===1;n&&(r=!r),fe(r),t.blending===1&&t.transparent===!1?ue(0):ue(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),W(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?B(e.SAMPLE_ALPHA_TO_COVERAGE):ae(e.SAMPLE_ALPHA_TO_COVERAGE)}function fe(t){O!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),O=t)}function U(t){t===0?ae(e.CULL_FACE):(B(e.CULL_FACE),t!==k&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),k=t}function pe(t){t!==A&&(P&&e.lineWidth(t),A=t)}function W(t,n,r){t?(B(e.POLYGON_OFFSET_FILL),(j!==n||M!==r)&&(j=n,M=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):ae(e.POLYGON_OFFSET_FILL)}function me(t){t?B(e.SCISSOR_TEST):ae(e.SCISSOR_TEST)}function he(t){t===void 0&&(t=e.TEXTURE0+N-1),L!==t&&(e.activeTexture(t),L=t)}function ge(t,n,r){r===void 0&&(r=L===null?e.TEXTURE0+N-1:L);let i=R[r];i===void 0&&(i={type:void 0,texture:void 0},R[r]=i),(i.type!==t||i.texture!==n)&&(L!==r&&(e.activeTexture(r),L=r),e.bindTexture(t,n||z[t]),i.type=t,i.texture=n)}function _e(){let t=R[L];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function ve(){try{e.compressedTexImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function ye(){try{e.compressedTexImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function be(){try{e.texSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function xe(){try{e.texSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Se(){try{e.compressedTexSubImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ce(){try{e.compressedTexSubImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function we(){try{e.texStorage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Te(){try{e.texStorage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Ee(){try{e.texImage2D(...arguments)}catch(e){H(`WebGLState:`,e)}}function De(){try{e.texImage3D(...arguments)}catch(e){H(`WebGLState:`,e)}}function Oe(t){return d[t]===void 0?e.getParameter(t):d[t]}function ke(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function Ae(t){ne.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ne.copy(t))}function je(t){re.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),re.copy(t))}function Me(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function K(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Ne(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},L=null,R={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,S=null,C=null,w=null,T=new G(0,0,0),E=0,D=!1,O=null,k=null,A=null,j=null,M=null,ne.set(0,0,e.canvas.width,e.canvas.height),re.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:B,disable:ae,bindFramebuffer:oe,drawBuffers:se,useProgram:V,setBlending:ue,setMaterial:de,setFlipSided:fe,setCullFace:U,setLineWidth:pe,setPolygonOffset:W,setScissorTest:me,activeTexture:he,bindTexture:ge,unbindTexture:_e,compressedTexImage2D:ve,compressedTexImage3D:ye,texImage2D:Ee,texImage3D:De,pixelStorei:ke,getParameter:Oe,updateUBOMapping:Me,uniformBlockBinding:K,texStorage2D:we,texStorage3D:Te,texSubImage2D:be,texSubImage3D:xe,compressedTexSubImage2D:Se,compressedTexSubImage3D:Ce,scissor:Ae,viewport:je,reset:Ne}}function pi(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new F,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function g(e,t){return m?new OffscreenCanvas(e,t):se(`canvas`)}function v(e,t,n){let r=1,i=we(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=g(n,a));let o=t?g(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),U(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}return`data`in e&&U(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e}return e}function y(e){return e.generateMipmaps}function b(t){e.generateMipmap(t)}function x(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function S(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];U(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||U(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?Je:Ue.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function C(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,U(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function w(e,t){return y(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function T(e){let t=e.target;t.removeEventListener(`dispose`,T),D(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function E(e){let t=e.target;t.removeEventListener(`dispose`,E),k(t)}function D(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&O(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function O(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function k(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let A=0;function j(){A=0}function M(){return A}function N(e){A=e}function P(){let e=A;return e>=i.maxTextures&&U(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),A+=1,e}function I(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function L(t,i){let a=r.get(t);if(t.isVideoTexture&&Se(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)U(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)U(`WebGLRenderer: Texture marked for update but image is incomplete`);else{ce(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function R(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){ce(a,t,i);return}t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null),n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i)}function ee(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){ce(a,t,i);return}n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function te(t,i){let a=r.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version){le(a,t,i);return}n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let ne={[Ve]:e.REPEAT,[q]:e.CLAMP_TO_EDGE,[Ye]:e.MIRRORED_REPEAT},re={[Fe]:e.NEAREST,[He]:e.NEAREST_MIPMAP_NEAREST,[be]:e.NEAREST_MIPMAP_LINEAR,[V]:e.LINEAR,[_]:e.LINEAR_MIPMAP_NEAREST,[fe]:e.LINEAR_MIPMAP_LINEAR},ie={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function z(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&U(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,ne[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,ne[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,ne[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,re[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,re[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ie[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function B(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,T));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=I(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&O(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function ae(e,t,n){return Math.floor(Math.floor(e/n)/t)}function oe(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=ae(n.start,r.width,4),c=ae(t.start,r.width,4);n.start<=i+1&&a===c&&ae(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function ce(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=B(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Ue.getPrimaries(Ue.workingColorSpace),r=o.colorSpace===``?null:Ue.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=v(o.image,!1,i.maxTextureSize);t=Ce(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=S(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);z(c,o);let g,_=o.mipmaps,x=o.isVideoTexture!==!0,T=f.__version===void 0||l===!0,E=u.dataReady,D=w(o,t);if(o.isDepthTexture)m=C(o.format===Pe,o.type),T&&(x?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture){if(_.length>0){x&&T&&n.texStorage2D(e.TEXTURE_2D,D,m,_[0].width,_[0].height);for(let t=0,i=_.length;t<i;t++)g=_[t],x?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,g.width,g.height,r,p,g.data):n.texImage2D(e.TEXTURE_2D,t,m,g.width,g.height,0,r,p,g.data);o.generateMipmaps=!1}else x?(T&&n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height),E&&oe(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data)}else if(o.isCompressedTexture){if(o.isCompressedArrayTexture){x&&T&&n.texStorage3D(e.TEXTURE_2D_ARRAY,D,m,_[0].width,_[0].height,t.depth);for(let i=0,a=_.length;i<a;i++)if(g=_[i],o.format!==1023){if(r!==null){if(x){if(E){if(o.layerUpdates.size>0){let t=h(g.width,g.height,o.format,o.type);for(let a of o.layerUpdates){let o=g.data.subarray(a*t/g.data.BYTES_PER_ELEMENT,(a+1)*t/g.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,g.width,g.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,g.width,g.height,t.depth,r,g.data)}}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,g.width,g.height,t.depth,0,g.data,0,0)}else U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`)}else x?E&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,g.width,g.height,t.depth,r,p,g.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,g.width,g.height,t.depth,0,r,p,g.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{x&&T&&n.texStorage2D(e.TEXTURE_2D,D,m,_[0].width,_[0].height);for(let t=0,i=_.length;t<i;t++)g=_[t],o.format===1023?x?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,g.width,g.height,r,p,g.data):n.texImage2D(e.TEXTURE_2D,t,m,g.width,g.height,0,r,p,g.data):r===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):x?E&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,g.width,g.height,r,g.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,g.width,g.height,0,g.data)}}else if(o.isDataArrayTexture){if(x){if(T&&n.texStorage3D(e.TEXTURE_2D_ARRAY,D,m,t.width,t.height,t.depth),E){if(o.layerUpdates.size>0){let i=h(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data)}else if(o.isData3DTexture)x?(T&&n.texStorage3D(e.TEXTURE_3D,D,m,t.width,t.height,t.depth),E&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(T){if(x)n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<D;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(_.length>0){if(x&&T){let t=we(_[0]);n.texStorage2D(e.TEXTURE_2D,D,m,t.width,t.height)}for(let t=0,i=_.length;t<i;t++)g=_[t],x?E&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,g):n.texImage2D(e.TEXTURE_2D,t,m,r,p,g);o.generateMipmaps=!1}else if(x){if(T){let r=we(t);n.texStorage2D(e.TEXTURE_2D,D,m,r.width,r.height)}E&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);y(o)&&b(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function le(t,o,s){if(o.image.length!==6)return;let c=B(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Ue.getPrimaries(Ue.workingColorSpace),r=o.colorSpace===``?null:Ue.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=v(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=Ce(o,m[e]);let h=m[0],g=a.convert(o.format,o.colorSpace),_=a.convert(o.type),x=S(o.internalFormat,g,_,o.normalized,o.colorSpace),C=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=w(o,h);z(e.TEXTURE_CUBE_MAP,o);let O;if(f){C&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,x,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?C?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,x,i.width,i.height,0,g,_,i.data):g===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):C?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,g,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,x,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,C&&T){O.length>0&&D++;let t=we(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,x,t.width,t.height)}for(let t=0;t<6;t++)if(p){C?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,g,_,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,x,m[t].width,m[t].height,0,g,_,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;C?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,g,_,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,x,i.width,i.height,0,g,_,i.data)}}else{C?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,g,_,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,x,g,_,m[t]);for(let r=0;r<O.length;r++){let i=O[r];C?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,g,_,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,x,g,_,i.image[t])}}}y(o)&&b(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ue(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=S(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),xe(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,G(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function de(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=C(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;xe(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,G(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,G(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=S(o.internalFormat,c,l,o.normalized,o.colorSpace);xe(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,G(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,G(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function pe(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,T)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),z(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else L(i.depthTexture,0);let u=l.__webglTexture,d=G(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)xe(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)xe(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function W(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer){if(a)for(let e=0;e<6;e++)pe(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?pe(i.__webglFramebuffer[0],t,0):pe(i.__webglFramebuffer,t,0)}}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),de(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),de(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function me(t,n,i){let a=r.get(t);n!==void 0&&ue(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&W(t)}function he(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,E);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&xe(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=S(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=G(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),de(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),z(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)ue(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else ue(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);y(i)&&b(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),z(c,a),ue(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),y(a)&&b(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),z(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)ue(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else ue(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);y(i)&&b(r),n.unbindTexture()}t.depthBuffer&&W(t)}function ge(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(y(a)){let t=x(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),b(t),n.unbindTexture()}}}let _e=[],ve=[];function ye(t){if(t.samples>0){if(xe(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(_e.length=0,ve.length=0,_e.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(_e.push(l),ve.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,ve)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,_e))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function G(e){return Math.min(i.maxSamples,e.samples)}function xe(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function Se(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function Ce(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Ue.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&U(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):H(`WebGLTextures: Unsupported texture color space:`,n)),t}function we(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=P,this.resetTextureUnits=j,this.getTextureUnits=M,this.setTextureUnits=N,this.setTexture2D=L,this.setTexture2DArray=R,this.setTexture3D=ee,this.setTextureCube=te,this.rebindTextures=me,this.setupRenderTarget=he,this.updateRenderTargetMipmap=ge,this.updateMultisampleRenderTarget=ye,this.setupDepthRenderbuffer=W,this.setupFrameBufferTexture=ue,this.useMultisampledRTT=xe,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function mi(e,t){function n(n,r=``){let i,a=Ue.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779){if(a===`srgb`){if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null}else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null}if(n===35840||n===35841||n===35842||n===35843){if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null}if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491){if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null}if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821){if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null}if(n===36492||n===36494||n===36495){if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null}if(n===36283||n===36284||n===36285||n===36286){if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null}return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var hi=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,gi=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,_i=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new at(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Me({vertexShader:hi,fragmentShader:gi,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new R(new Ee(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},vi=class extends Ce{constructor(e,t){super();let n=this,i=null,a=1,o=null,s=`local-floor`,c=1,l=null,u=null,f=null,m=null,h=null,g=null,_=typeof XRWebGLBinding<`u`,v=new _i,y={},b=t.getContextAttributes(),S=null,C=null,w=[],T=[],E=new F,D=null,O=null,k=new J;k.viewport=new x;let A=new J;A.viewport=new x;let j=[k,A],M=new pe,P=null,I=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=w[e];return t===void 0&&(t=new st,w[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=w[e];return t===void 0&&(t=new st,w[e]=t),t.getGripSpace()},this.getHand=function(e){let t=w[e];return t===void 0&&(t=new st,w[e]=t),t.getHandSpace()};function L(e){let t=T.indexOf(e.inputSource);if(t===-1)return;let n=w[t];n!==void 0&&(n.update(e.inputSource,e.frame,l||o),n.dispatchEvent({type:e.type,data:e.inputSource}))}function R(){i.removeEventListener(`select`,L),i.removeEventListener(`selectstart`,L),i.removeEventListener(`selectend`,L),i.removeEventListener(`squeeze`,L),i.removeEventListener(`squeezestart`,L),i.removeEventListener(`squeezeend`,L),i.removeEventListener(`end`,R),i.removeEventListener(`inputsourceschange`,te);for(let e=0;e<w.length;e++){let t=T[e];t!==null&&(T[e]=null,w[e].disconnect(t))}P=null,I=null,v.reset();for(let e in y)delete y[e];if(e.setRenderTarget(S),h=null,m=null,f=null,i=null,C=null,V.stop(),n.isPresenting=!1,e.setPixelRatio(D),e.setSize(E.width,E.height,!1),O!==null){let e=O.camera;e.fov=O.fov,e.zoom=O.zoom,e.updateProjectionMatrix(),O=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){a=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){s=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(e){l=e},this.getBaseLayer=function(){return m===null?h:m},this.getBinding=function(){return f===null&&_&&(f=new XRWebGLBinding(i,t)),f},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(u){if(i=u,i!==null){if(S=e.getRenderTarget(),i.addEventListener(`select`,L),i.addEventListener(`selectstart`,L),i.addEventListener(`selectend`,L),i.addEventListener(`squeeze`,L),i.addEventListener(`squeezestart`,L),i.addEventListener(`squeezeend`,L),i.addEventListener(`end`,R),i.addEventListener(`inputsourceschange`,te),b.xrCompatible!==!0&&await t.makeXRCompatible(),D=e.getPixelRatio(),e.getSize(E),_&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,o=null,s=null;b.depth&&(s=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=b.stencil?Pe:ze,o=b.stencil?N:r);let c={colorFormat:t.RGBA8,depthFormat:s,scaleFactor:a};f=this.getBinding(),m=f.createProjectionLayer(c),i.updateRenderState({layers:[m]}),e.setPixelRatio(1),e.setSize(m.textureWidth,m.textureHeight,!1),C=new ee(m.textureWidth,m.textureHeight,{format:re,type:d,depthTexture:new K(m.textureWidth,m.textureHeight,o,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:m.ignoreDepthValues===!1,resolveStencilBuffer:m.ignoreDepthValues===!1,storeMultisampledDepthBuffer:m.ignoreDepthValues===!1,storeMultisampledStencilBuffer:m.ignoreDepthValues===!1})}else{let n={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:a};h=new XRWebGLLayer(i,t,n),i.updateRenderState({baseLayer:h}),e.setPixelRatio(1),e.setSize(h.framebufferWidth,h.framebufferHeight,!1),C=new ee(h.framebufferWidth,h.framebufferHeight,{format:re,type:d,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1,storeMultisampledDepthBuffer:h.ignoreDepthValues===!1,storeMultisampledStencilBuffer:h.ignoreDepthValues===!1})}C.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await i.requestReferenceSpace(s),V.setContext(i),V.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function te(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=T.indexOf(n);r>=0&&(T[r]=null,w[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=T.indexOf(n);if(r===-1){for(let e=0;e<w.length;e++)if(e>=T.length){T.push(n),r=e;break}else if(T[e]===null){T[e]=n,r=e;break}if(r===-1)break}let i=w[r];i&&i.connect(n)}}let ne=new p,ie=new p;function z(e,t,n){ne.setFromMatrixPosition(t.matrixWorld),ie.setFromMatrixPosition(n.matrixWorld);let r=ne.distanceTo(ie),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function B(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(i===null)return;let t=e.near,n=e.far;v.texture!==null&&(v.depthNear>0&&(t=v.depthNear),v.depthFar>0&&(n=v.depthFar)),M.near=A.near=k.near=t,M.far=A.far=k.far=n,(P!==M.near||I!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),P=M.near,I=M.far),M.layers.mask=e.layers.mask|6,k.layers.mask=M.layers.mask&-5,A.layers.mask=M.layers.mask&-3;let r=e.parent,a=M.cameras;B(M,r);for(let e=0;e<a.length;e++)B(a[e],r);a.length===2?z(M,k,A):M.projectionMatrix.copy(k.projectionMatrix),O===null&&e.isPerspectiveCamera&&(O={camera:e,fov:e.fov,zoom:e.zoom}),ae(e,M,r)};function ae(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=_e*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(m!==null||h!==null)return c},this.setFoveation=function(e){c=e,m!==null&&(m.fixedFoveation=e),h!==null&&h.fixedFoveation!==void 0&&(h.fixedFoveation=e)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(M)},this.getCameraTexture=function(e){return y[e]};let oe=null;function se(t,r){if(u=r.getViewerPose(l||o),g=r,u!==null){let t=u.views;h!==null&&(e.setRenderTargetFramebuffer(C,h.framebuffer),e.setRenderTarget(C));let r=!1;t.length!==M.cameras.length&&(M.cameras.length=0,r=!0);for(let n=0;n<t.length;n++){let i=t[n],a=null;if(h!==null)a=h.getViewport(i);else{let t=f.getViewSubImage(m,i);a=t.viewport,n===0&&(e.setRenderTargetTextures(C,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(C))}let o=j[n];o===void 0&&(o=new J,o.layers.enable(n),o.viewport=new x,j[n]=o),o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(i.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(M.matrix.copy(o.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),r===!0&&M.cameras.push(o)}let a=i.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&i.depthUsage==`gpu-optimized`&&_){f=n.getBinding();let e=f.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&v.init(e,i.renderState)}if(a&&a.includes(`camera-access`)&&_){e.state.unbindTexture(),f=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=y[n];e||(e=new at,y[n]=e);let t=f.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<w.length;e++){let t=T[e],n=w[e];t!==null&&n!==void 0&&n.update(t,r,l||o)}oe&&oe(t,r),r.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:r}),g=null}let V=new lt;V.setAnimationLoop(se),this.setAnimationLoop=function(e){oe=e},this.dispose=function(){}}},yi=new ge,bi=new W;bi.set(-1,0,0,0,1,0,0,0,1);function xi(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,T(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(yi.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(bi),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Si(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return H(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return r[a]=typeof i==`number`||typeof i==`boolean`?i:ArrayBuffer.isView(i)?i.slice():i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?U(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):U(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var Ci=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),wi=null;function Ti(){return wi===null&&(wi=new je(Ci,16,16,e,P),wi.name=`DFG_LUT`,wi.minFilter=V,wi.magFilter=V,wi.wrapS=q,wi.wrapT=q,wi.generateMipmaps=!1,wi.needsUpdate=!0),wi}var Ei=class{constructor(e={}){let{canvas:t=v(),context:n=null,depth:i=!0,stencil:a=!1,alpha:o=!1,antialias:c=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:u=!1,powerPreference:f=`default`,failIfMajorPerformanceCaveat:m=!1,reversedDepthBuffer:h=!1,outputBufferType:g=d}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);_=n.getContextAttributes().alpha}else _=o;let y=g,b=new Set([s,Oe,ye]),S=new Set([d,r,j,N,Ie,A]),C=new Uint32Array(4),w=new Int32Array(4),T=new p,E=null,O=null,k=[],M=[],F=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,L=!1,R=null,te=null,ne=null,re=null;this._outputColorSpace=We;let ie=0,z=0,B=null,ae=-1,se=null,V=new x,ce=new x,le=null,ue=new G(0),de=0,pe=t.width,W=t.height,he=1,_e=null,ve=null,be=new x(0,0,pe,W),xe=new x(0,0,pe,W),Se=!1,Ce=new oe,we=!1,Te=!1,Ee=new ge,De=new p,ke=new x,Ae={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},je=!1;function Me(){return B===null?he:1}let K=n;function Ne(e,n){return t.getContext(e,n)}let Pe,Fe,q,Le,J,Y,Re,ze,Be,Ve,He,Ge,qe,Je,Ye,Xe,Ze,Qe,$e,et,tt,nt,rt;try{let e={alpha:!0,depth:i,stencil:a,antialias:c,premultipliedAlpha:l,preserveDrawingBuffer:u,powerPreference:f,failIfMajorPerformanceCaveat:m};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,ot,!1),t.addEventListener(`webglcontextrestored`,st,!1),t.addEventListener(`webglcontextcreationerror`,ct,!1),K===null){let t=`webgl2`;if(K=Ne(t,e),K===null)throw Ne(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}it()}catch(e){throw t.removeEventListener(`webglcontextlost`,ot,!1),t.removeEventListener(`webglcontextrestored`,st,!1),t.removeEventListener(`webglcontextcreationerror`,ct,!1),H(`WebGLRenderer: `+e.message),e}function it(){Pe=new Ut(K),Pe.init(),tt=new mi(K,Pe),Fe=new vt(K,Pe,e,tt),q=new fi(K,Pe),Fe.reversedDepthBuffer&&h&&q.buffers.depth.setReversed(!0),te=K.createFramebuffer(),ne=K.createFramebuffer(),re=K.createFramebuffer(),Le=new Kt(K),J=new Kr,Y=new pi(K,Pe,q,J,Fe,tt,Le),Re=new Ht(I),ze=new ut(K),nt=new gt(K,ze),Be=new Wt(K,ze,Le,nt),Ve=new Jt(K,Be,ze,nt,Le),Qe=new qt(K,Fe,Y),Ye=new yt(J),He=new Gr(I,Re,Pe,Fe,nt,Ye),Ge=new xi(I,J),qe=new Xr,Je=new ri(Pe),Ze=new ht(I,Re,q,Ve,_,l),Xe=new di(I,Ve,Fe),rt=new Si(K,Le,Fe,q),$e=new _t(K,Pe,Le),et=new Gt(K,Pe,Le),Le.programs=He.programs,I.capabilities=Fe,I.extensions=Pe,I.properties=J,I.renderLists=qe,I.shadowMap=Xe,I.state=q,I.info=Le}y!==1009&&(F=new Xt(y,t.width,t.height,c,i,a));let at=new vi(I,K);this.xr=at,this.getContext=function(){return K},this.getContextAttributes=function(){return K.getContextAttributes()},this.forceContextLoss=function(){let e=Pe.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=Pe.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return he},this.setPixelRatio=function(e){e!==void 0&&(he=e,this.setSize(pe,W,!1))},this.getSize=function(e){return e.set(pe,W)},this.setSize=function(e,n,r=!0){if(at.isPresenting){U(`WebGLRenderer: Can't change size while VR device is presenting.`);return}pe=e,W=n,t.width=Math.floor(e*he),t.height=Math.floor(n*he),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),F!==null&&F.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(pe*he,W*he).floor()},this.setDrawingBufferSize=function(e,n,r){pe=e,W=n,he=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(y===1009){H(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){U(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}F.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(V)},this.getViewport=function(e){return e.copy(be)},this.setViewport=function(e,t,n,r){e.isVector4?be.set(e.x,e.y,e.z,e.w):be.set(e,t,n,r),q.viewport(V.copy(be).multiplyScalar(he).round())},this.getScissor=function(e){return e.copy(xe)},this.setScissor=function(e,t,n,r){e.isVector4?xe.set(e.x,e.y,e.z,e.w):xe.set(e,t,n,r),q.scissor(ce.copy(xe).multiplyScalar(he).round())},this.getScissorTest=function(){return Se},this.setScissorTest=function(e){q.setScissorTest(Se=e)},this.setOpaqueSort=function(e){_e=e},this.setTransparentSort=function(e){ve=e},this.getClearColor=function(e){return e.copy(Ze.getClearColor())},this.setClearColor=function(){Ze.setClearColor(...arguments)},this.getClearAlpha=function(){return Ze.getClearAlpha()},this.setClearAlpha=function(){Ze.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(B!==null){let t=B.texture.format;e=b.has(t)}if(e){let e=B.texture.type,t=S.has(e),n=Ze.getClearColor(),r=Ze.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(C[0]=i,C[1]=a,C[2]=o,C[3]=r,K.clearBufferuiv(K.COLOR,0,C)):(w[0]=i,w[1]=a,w[2]=o,w[3]=r,K.clearBufferiv(K.COLOR,0,w))}else r|=K.COLOR_BUFFER_BIT}t&&(r|=K.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=K.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&K.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),R=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,ot,!1),t.removeEventListener(`webglcontextrestored`,st,!1),t.removeEventListener(`webglcontextcreationerror`,ct,!1),Ze.dispose(),qe.dispose(),Je.dispose(),J.dispose(),Re.dispose(),Ve.dispose(),nt.dispose(),rt.dispose(),He.dispose(),at.dispose(),at.removeEventListener(`sessionstart`,bt),at.removeEventListener(`sessionend`,xt),St.stop()};function ot(e){e.preventDefault(),Ke(`WebGLRenderer: Context Lost.`),L=!0}function st(){Ke(`WebGLRenderer: Context Restored.`),L=!1;let e=Le.autoReset,t=Xe.enabled,n=Xe.autoUpdate,r=Xe.needsUpdate,i=Xe.type;it(),Le.autoReset=e,Xe.enabled=t,Xe.autoUpdate=n,Xe.needsUpdate=r,Xe.type=i}function ct(e){H(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function X(e){let t=e.target;t.removeEventListener(`dispose`,X),Z(t)}function Z(e){dt(e),J.remove(e)}function dt(e){let t=J.get(e).programs;t!==void 0&&(t.forEach(function(e){He.releaseProgram(e)}),e.isShaderMaterial&&He.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Ae);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=Mt(e,t,n,r,i);q.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Be.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;nt.setup(i,r,s,n,c);let h,g=$e;if(c!==null&&(h=ze.get(c),g=et,g.setIndex(h)),i.isMesh)r.wireframe===!0?(q.setLineWidth(r.wireframeLinewidth*Me()),g.setMode(K.LINES)):g.setMode(K.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),q.setLineWidth(e*Me()),i.isLineSegments?g.setMode(K.LINES):i.isLineLoop?g.setMode(K.LINE_LOOP):g.setMode(K.LINE_STRIP)}else i.isPoints?g.setMode(K.POINTS):i.isSprite&&g.setMode(K.TRIANGLES);if(i.isBatchedMesh){if(Pe.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?ze.get(c).bytesPerElement:1,o=J.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(K,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function ft(e,t,n,r){R!==null&&e.isNodeMaterial&&R.setObject(r,e),we===!0&&Ye.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,Ot(e,t,r),e.side=0,e.needsUpdate=!0,Ot(e,t,r),e.side=2):Ot(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),R!==null&&R.renderStart(e,t,n),O=Je.get(n),O.init(t),M.push(O),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(O.pushLight(e),e.castShadow&&O.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(O.pushLight(e),e.castShadow&&O.pushShadow(e))}),O.setupLights(),R!==null&&R.updateLights(O.state.lightsArray),Te=this.localClippingEnabled,we=Ye.init(this.clippingPlanes,Te),we===!0&&Ye.setGlobalState(this.clippingPlanes,t),R!==null&&Xe.render(O.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i){if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];ft(o,n,t,e),r.add(o)}else ft(i,n,t,e),r.add(i)}}),O=M.pop(),R!==null&&R.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){let t=J.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}Pe.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let pt=null;function mt(e){pt&&pt(e)}function bt(){St.stop()}function xt(){St.start()}let St=new lt;St.setAnimationLoop(mt),typeof self<`u`&&St.setContext(self),this.setAnimationLoop=function(e){pt=e,at.setAnimationLoop(e),e===null?St.stop():St.start()},at.addEventListener(`sessionstart`,bt),at.addEventListener(`sessionend`,xt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){H(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(L===!0)return;R!==null&&R.renderStart(e,t);let n=at.enabled===!0&&at.isPresenting===!0,r=F!==null&&(B===null||n)&&F.begin(I,B);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),at.enabled===!0&&at.isPresenting===!0&&(F===null||F.isCompositing()===!1)&&(at.cameraAutoUpdate===!0&&at.updateCamera(t),t=at.getCamera()),e.isScene===!0&&e.onBeforeRender(I,e,t,B),O=Je.get(e,M.length),O.init(t),O.state.textureUnits=Y.getTextureUnits(),M.push(O),Ee.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),Ce.setFromProjectionMatrix(Ee,D,t.reversedDepth),Te=this.localClippingEnabled,we=Ye.init(this.clippingPlanes,Te),E=qe.get(e,k.length),E.init(),k.push(E),at.enabled===!0&&at.isPresenting===!0){let e=I.xr.getDepthSensingMesh();e!==null&&Ct(e,t,-1/0,I.sortObjects)}Ct(e,t,0,I.sortObjects),E.finish(),R!==null&&R.updateLights(O.state.lightsArray),I.sortObjects===!0&&E.sort(_e,ve),je=at.enabled===!1||at.isPresenting===!1||at.hasDepthSensing()===!1,je&&Ze.addToRenderList(E,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),we===!0&&Ye.beginShadows();let i=O.state.shadowsArray;if(Xe.render(i,e,t),we===!0&&Ye.endShadows(),(r&&F.hasRenderPass())===!1){let n=E.opaque,r=E.transmissive;if(O.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];Tt(n,r,e,a)}je&&Ze.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];wt(E,e,n,n.viewport)}}else r.length>0&&Tt(n,r,e,t),je&&Ze.render(e),wt(E,e,t)}B!==null&&z===0&&(Y.updateMultisampleRenderTarget(B),Y.updateRenderTargetMipmap(B)),r&&F.end(I),e.isScene===!0&&e.onAfterRender(I,e,t),nt.resetDefaultState(),ae=-1,se=null,M.pop(),M.length>0?(O=M[M.length-1],Y.setTextureUnits(O.state.textureUnits),we===!0&&Ye.setGlobalState(I.clippingPlanes,O.state.camera)):O=null,k.pop(),E=k.length>0?k[k.length-1]:null,R!==null&&R.renderEnd()};function Ct(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)O.pushLightProbeGrid(e);else if(e.isLight)O.pushLight(e),e.castShadow&&O.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(Ce)){r&&ke.setFromMatrixPosition(e.matrixWorld).applyMatrix4(Ee);let i=Ve.update(e),a=e.material;a.visible&&E.push(e,i,a,n,ke.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(Ce))){let i=Ve.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),ke.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),ke.copy(e.boundingSphere.center)),ke.applyMatrix4(e.matrixWorld).applyMatrix4(Ee)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&E.push(e,i,c,n,ke.z,s,t)}}else a.visible&&E.push(e,i,a,n,ke.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)Ct(i[e],t,n,r)}function wt(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;O.setupLightsView(n),we===!0&&Ye.setGlobalState(I.clippingPlanes,n),r&&q.viewport(V.copy(r)),i.length>0&&Et(i,t,n),a.length>0&&Et(a,t,n),o.length>0&&Et(o,t,n),q.buffers.depth.setTest(!0),q.buffers.depth.setMask(!0),q.buffers.color.setMask(!0),q.setPolygonOffset(!1)}function Tt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(O.state.transmissionRenderTarget[r.id]===void 0){let e=Pe.has(`EXT_color_buffer_half_float`)||Pe.has(`EXT_color_buffer_float`);O.state.transmissionRenderTarget[r.id]=new ee(1,1,{generateMipmaps:!0,type:e?P:d,minFilter:fe,samples:Math.max(4,Fe.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Ue.workingColorSpace})}let i=O.state.transmissionRenderTarget[r.id],o=r.viewport||V;i.setSize(o.z*I.transmissionResolutionScale,o.w*I.transmissionResolutionScale);let s=I.getRenderTarget(),c=I.getActiveCubeFace(),l=I.getActiveMipmapLevel();I.setRenderTarget(i),I.getClearColor(ue),de=I.getClearAlpha(),de<1&&I.setClearColor(16777215,.5),I.clear(),je&&Ze.render(n);let u=I.toneMapping;I.toneMapping=0;let f=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),O.setupLightsView(r),we===!0&&Ye.setGlobalState(I.clippingPlanes,r),Et(e,n,r),Y.updateMultisampleRenderTarget(i),Y.updateRenderTargetMipmap(i),Pe.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,Dt(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(Y.updateMultisampleRenderTarget(i),Y.updateRenderTargetMipmap(i))}I.setRenderTarget(s,c,l),I.setClearColor(ue,de),f!==void 0&&(r.viewport=f),I.toneMapping=u}function Et(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&Dt(o,t,n,s,l,c)}}function Dt(e,t,n,r,i,a){R!==null&&i.isNodeMaterial&&R.setObject(e,i),e.onBeforeRender(I,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(I,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,I.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,I.renderBufferDirect(n,t,r,i,e,a),i.side=2):I.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(I,t,n,r,i,a)}function Ot(e,t,n){t.isScene!==!0&&(t=Ae);let r=J.get(e),i=O.state.lights,a=O.state.shadowsArray,o=i.state.version,s=He.getParameters(e,i.state,a,t,n,O.state.lightProbeGridArray),c=He.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Re.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,X),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return At(e,s),d}else s.uniforms=He.getUniforms(e),R!==null&&e.isNodeMaterial&&R.build(e,n,s),e.onBeforeCompile(s,I),d=He.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Ye.uniform),At(e,s),r.needsLights=Pt(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=O.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function kt(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=ir.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function At(e,t){let n=J.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function jt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];T.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(T))return n}return null}function Mt(e,t,n,r,i){t.isScene!==!0&&(t=Ae),Y.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=B===null?I.outputColorSpace:B.isXRRenderTarget===!0?B.texture.colorSpace:Ue.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Re.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(B===null||B.isXRRenderTarget===!0)&&(h=I.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=J.get(r),y=O.state.lights;if(we===!0&&(Te===!0||e!==se)){let t=e===se&&r.id===ae;Ye.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Ye.numPlanes||v.numIntersection!==Ye.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=O.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let x=v.currentProgram;b===!0&&(x=Ot(r,t,i),R&&r.isNodeMaterial&&R.onUpdateProgram(r,x,v));let S=!1,C=!1,w=!1,T=x.getUniforms(),E=v.uniforms;if(q.useProgram(x.program)&&(S=!0,C=!0,w=!0),r.id!==ae&&(ae=r.id,C=!0),v.needsLights){let e=jt(O.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,C=!0)}if(S||se!==e){q.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),T.setValue(K,`projectionMatrix`,e.projectionMatrix),T.setValue(K,`viewMatrix`,e.matrixWorldInverse);let t=T.map.cameraPosition;t!==void 0&&t.setValue(K,De.setFromMatrixPosition(e.matrixWorld)),Fe.logarithmicDepthBuffer&&T.setValue(K,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&T.setValue(K,`isOrthographic`,e.isOrthographicCamera===!0),se!==e&&(se=e,C=!0,w=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&T.setValue(K,`sunShadowMap`,y.state.sunShadowMap,Y),y.state.directionalShadowMap.length>0&&T.setValue(K,`directionalShadowMap`,y.state.directionalShadowMap,Y),y.state.spotShadowMap.length>0&&T.setValue(K,`spotShadowMap`,y.state.spotShadowMap,Y),y.state.pointShadowMap.length>0&&T.setValue(K,`pointShadowMap`,y.state.pointShadowMap,Y)),i.isSkinnedMesh){T.setOptional(K,i,`bindMatrix`),T.setOptional(K,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),T.setValue(K,`boneTexture`,e.boneTexture,Y))}i.isBatchedMesh&&(T.setOptional(K,i,`batchingTexture`),T.setValue(K,`batchingTexture`,i._matricesTexture,Y),T.setOptional(K,i,`batchingIdTexture`),T.setValue(K,`batchingIdTexture`,i._indirectTexture,Y),T.setOptional(K,i,`batchingColorTexture`),i._colorsTexture!==null&&T.setValue(K,`batchingColorTexture`,i._colorsTexture,Y));let D=n.morphAttributes;if((D.position!==void 0||D.normal!==void 0||D.color!==void 0)&&Qe.update(i,n,x),(C||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,T.setValue(K,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(E.envMapIntensity.value=t.environmentIntensity),E.dfgLUT!==void 0&&(E.dfgLUT.value=Ti()),C){if(T.setValue(K,`toneMappingExposure`,I.toneMappingExposure),v.needsLights&&Nt(E,w),a&&r.fog===!0&&Ge.refreshFogUniforms(E,a),Ge.refreshMaterialUniforms(E,r,he,W,O.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;E.probesSH.value=e.texture,E.probesMin.value.copy(e.boundingBox.min),E.probesMax.value.copy(e.boundingBox.max),E.probesResolution.value.copy(e.resolution)}ir.upload(K,kt(v),E,Y)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(ir.upload(K,kt(v),E,Y),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&T.setValue(K,`center`,i.center),T.setValue(K,`modelViewMatrix`,i.modelViewMatrix),T.setValue(K,`normalMatrix`,i.normalMatrix),T.setValue(K,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];rt.update(n,x),rt.bind(n,x)}}return x}function Nt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function Pt(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return ie},this.getActiveMipmapLevel=function(){return z},this.getRenderTarget=function(){return B},this.setRenderTargetTextures=function(e,t,n){let r=J.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),J.get(e.texture).__webglTexture=t,J.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=J.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){B=e,ie=t,z=n;let r=null,i=!1,a=!1;if(e){let o=J.get(e);if(o.__useDefaultFramebuffer!==void 0){q.bindFramebuffer(K.FRAMEBUFFER,o.__webglFramebuffer),V.copy(e.viewport),ce.copy(e.scissor),le=e.scissorTest,q.viewport(V),q.scissor(ce),q.setScissorTest(le),ae=-1;return}if(o.__webglFramebuffer===void 0)Y.setupRenderTarget(e);else if(o.__hasExternalTextures)Y.rebindTextures(e,J.get(e.texture).__webglTexture,J.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&J.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);Y.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=J.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&Y.useMultisampledRTT(e)===!1?J.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,V.copy(e.viewport),ce.copy(e.scissor),le=e.scissorTest}else V.copy(be).multiplyScalar(he).floor(),ce.copy(xe).multiplyScalar(he).floor(),le=Se;if(n!==0&&(r=te),q.bindFramebuffer(K.FRAMEBUFFER,r)&&q.drawBuffers(e,r),q.viewport(V),q.scissor(ce),q.setScissorTest(le),i){let r=J.get(e.texture);K.framebufferTexture2D(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=J.get(e.textures[t]);K.framebufferTextureLayer(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=J.get(e.texture);K.framebufferTexture2D(K.FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,t.__webglTexture,n)}ae=-1};function Ft(e){let t=J.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=Fe.textureFormatReadable(e.format),t.__typeReadable=Fe.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=J.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){q.bindFramebuffer(K.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&K.readBuffer(K.COLOR_ATTACHMENT0+s);let u=Ft(o);if(u.__formatReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){H(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&K.readPixels(t,n,r,i,tt.convert(c),tt.convert(l),a)}finally{let e=B===null?null:J.get(B).__webglFramebuffer;q.bindFramebuffer(K.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=J.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){q.bindFramebuffer(K.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&K.readBuffer(K.COLOR_ATTACHMENT0+s);let d=Ft(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=K.createBuffer();K.bindBuffer(K.PIXEL_PACK_BUFFER,f),K.bufferData(K.PIXEL_PACK_BUFFER,a.byteLength,K.STREAM_READ),K.readPixels(t,n,r,i,tt.convert(l),tt.convert(u),0),K.bindBuffer(K.PIXEL_PACK_BUFFER,null);let p=B===null?null:J.get(B).__webglFramebuffer;q.bindFramebuffer(K.FRAMEBUFFER,p);let m=K.fenceSync(K.SYNC_GPU_COMMANDS_COMPLETE,0);return K.flush(),await me(K,m,4),K.bindBuffer(K.PIXEL_PACK_BUFFER,f),K.getBufferSubData(K.PIXEL_PACK_BUFFER,0,a),K.bindBuffer(K.PIXEL_PACK_BUFFER,null),K.deleteBuffer(f),K.deleteSync(m),a}throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)}},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;Y.setTexture2D(e,0),K.copyTexSubImage2D(K.TEXTURE_2D,n,0,0,o,s,i,a),q.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=tt.convert(t.format),_=tt.convert(t.type),v;t.isData3DTexture?(Y.setTexture3D(t,0),v=K.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(Y.setTexture2DArray(t,0),v=K.TEXTURE_2D_ARRAY):(Y.setTexture2D(t,0),v=K.TEXTURE_2D),q.activeTexture(K.TEXTURE0),q.pixelStorei(K.UNPACK_FLIP_Y_WEBGL,t.flipY),q.pixelStorei(K.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),q.pixelStorei(K.UNPACK_ALIGNMENT,t.unpackAlignment);let y=q.getParameter(K.UNPACK_ROW_LENGTH),b=q.getParameter(K.UNPACK_IMAGE_HEIGHT),x=q.getParameter(K.UNPACK_SKIP_PIXELS),S=q.getParameter(K.UNPACK_SKIP_ROWS),C=q.getParameter(K.UNPACK_SKIP_IMAGES);q.pixelStorei(K.UNPACK_ROW_LENGTH,h.width),q.pixelStorei(K.UNPACK_IMAGE_HEIGHT,h.height),q.pixelStorei(K.UNPACK_SKIP_PIXELS,l),q.pixelStorei(K.UNPACK_SKIP_ROWS,u),q.pixelStorei(K.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=J.get(e),r=J.get(t),h=J.get(n.__renderTarget),g=J.get(r.__renderTarget);q.bindFramebuffer(K.READ_FRAMEBUFFER,h.__webglFramebuffer),q.bindFramebuffer(K.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(K.framebufferTextureLayer(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,J.get(e).__webglTexture,i,d+n),K.framebufferTextureLayer(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,J.get(t).__webglTexture,a,m+n)),K.blitFramebuffer(l,u,o,s,f,p,o,s,K.DEPTH_BUFFER_BIT,K.NEAREST);q.bindFramebuffer(K.READ_FRAMEBUFFER,null),q.bindFramebuffer(K.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||J.has(e)){let n=J.get(e),r=J.get(t);q.bindFramebuffer(K.READ_FRAMEBUFFER,ne),q.bindFramebuffer(K.DRAW_FRAMEBUFFER,re);for(let e=0;e<c;e++)w?K.framebufferTextureLayer(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):K.framebufferTexture2D(K.READ_FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,n.__webglTexture,i),T?K.framebufferTextureLayer(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):K.framebufferTexture2D(K.DRAW_FRAMEBUFFER,K.COLOR_ATTACHMENT0,K.TEXTURE_2D,r.__webglTexture,a),i===0?T?K.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):K.copyTexSubImage2D(v,a,f,p,l,u,o,s):K.blitFramebuffer(l,u,o,s,f,p,o,s,K.COLOR_BUFFER_BIT,K.NEAREST);q.bindFramebuffer(K.READ_FRAMEBUFFER,null),q.bindFramebuffer(K.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?K.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?K.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):K.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?K.texSubImage2D(K.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?K.compressedTexSubImage2D(K.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):K.texSubImage2D(K.TEXTURE_2D,a,f,p,o,s,g,_,h);q.pixelStorei(K.UNPACK_ROW_LENGTH,y),q.pixelStorei(K.UNPACK_IMAGE_HEIGHT,b),q.pixelStorei(K.UNPACK_SKIP_PIXELS,x),q.pixelStorei(K.UNPACK_SKIP_ROWS,S),q.pixelStorei(K.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&K.generateMipmap(v),q.unbindTexture()},this.initRenderTarget=function(e){J.get(e).__webglFramebuffer===void 0&&Y.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?Y.setTextureCube(e,0):e.isData3DTexture?Y.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?Y.setTexture2DArray(e,0):Y.setTexture2D(e,0),q.unbindTexture()},this.resetState=function(){ie=0,z=0,B=null,q.reset(),nt.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return D}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Ue._getDrawingBufferColorSpace(e),t.unpackColorSpace=Ue._getUnpackColorSpace()}},Q={uTime:{value:0},uNight:{value:0},uWind:{value:new F(1,.35)},uWindStrength:{value:1},uCameraYaw:{value:0},uCameraPosition:{value:new p},uSunDirection:{value:new p(.4,.8,.45).normalize()},uSunColor:{value:new G(1,.9,.75)},uFogColor:{value:new G(.6,.65,.75)},uFogStart:{value:new Float32Array(2)}};function Di(e,t=!1){let n=e[0].index!==null,r=new Set(Object.keys(e[0].attributes)),i=new Set(Object.keys(e[0].morphAttributes)),a={},o={},s=e[0].morphTargetsRelative,c=new Ae,l=0;for(let u=0;u<e.length;++u){let d=e[u],f=0;if(n!==(d.index!==null))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.`),null;for(let e in d.attributes){if(!r.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure "`+e+`" attribute exists among all geometries, or in none of them.`),null;a[e]===void 0&&(a[e]=[]),a[e].push(d.attributes[e]),f++}if(f!==r.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of attributes.`),null;if(s!==d.morphTargetsRelative)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. .morphTargetsRelative must be consistent throughout all geometries.`),null;for(let e in d.morphAttributes){if(!i.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`.  .morphAttributes must be consistent throughout all geometries.`),null;o[e]===void 0&&(o[e]=[]),o[e].push(d.morphAttributes[e])}if(t){let e;if(n)e=d.index.count;else if(d.attributes.position!==void 0)e=d.attributes.position.count;else return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. The geometry must have either an index or a position attribute`),null;c.addGroup(l,e,u),l+=e}}if(n){let t=0,n=[];for(let r=0;r<e.length;++r){let i=e[r].index;for(let e=0;e<i.count;++e)n.push(i.getX(e)+t);t+=e[r].attributes.position.count}c.setIndex(n)}for(let e in a){let t=Oi(a[e]);if(!t)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` attribute.`),null;c.setAttribute(e,t)}for(let e in o){let t=o[e][0].length;if(t!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[e]=[];for(let n=0;n<t;++n){let t=[];for(let r=0;r<o[e].length;++r)t.push(o[e][r][n]);let r=Oi(t);if(!r)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` morphAttribute.`),null;c.morphAttributes[e].push(r)}}}return c}function Oi(e){let n,r,i,a=-1,o=0;for(let t=0;t<e.length;++t){let s=e[t];if(n===void 0&&(n=s.array.constructor),n!==s.array.constructor)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.`),null;if(r===void 0&&(r=s.itemSize),r!==s.itemSize)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.`),null;if(i===void 0&&(i=s.normalized),i!==s.normalized)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.`),null;if(a===-1&&(a=s.gpuType),a!==s.gpuType)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.`),null;o+=s.count*r}let s=new n(o),c=new t(s,r,i),l=0;for(let t=0;t<e.length;++t){let n=e[t];if(n.isInterleavedBufferAttribute){let e=l/r;for(let t=0,i=n.count;t<i;t++)for(let i=0;i<r;i++){let r=n.getComponent(t,i);c.setComponent(t+e,i,r)}}else s.set(n.array,l);l+=n.count*r}return a!==void 0&&(c.gpuType=a),c}function ki(e){let t=e.next();for(;!t.done;)t=e.next();return t.value}function Ai(e,t){return ki(ji(e,t))}function*ji(e,{x:t,z:n,weight:r=()=>1,maxWeight:i=1/0,maxExtent:a=1/0,minWeight:o=0}){if(!e.length)return[];let s=e.length,c=new Float64Array(s),l=new Float64Array(s),u=new Float64Array(s);for(let i=0;i<s;i++)c[i]=t(e[i]),l[i]=n(e[i]),u[i]=Math.max(0,r(e[i])||0);let d=Array(s);for(let e=0;e<s;e++)d[e]=e;yield;let f=[],p=[d];for(;p.length;){let e=p.pop(),t=0;for(let n of e)t+=u[n];let n=1/0,r=-1/0,s=1/0,d=-1/0;for(let t of e)c[t]<n&&(n=c[t]),c[t]>r&&(r=c[t]),l[t]<s&&(s=l[t]),l[t]>d&&(d=l[t]);let m=Math.max(r-n,d-s)>a&&t>o;if(e.length<2||!(t>i||m)){f.push(e);continue}let h=Mi(e,r-n>=d-s?c:l),g=0,_=1;for(let e=0;e<h.length-1&&(g+=u[h[e]],_=e+1,!(g>=t/2));e++);p.push(h.slice(_),h.slice(0,_)),yield}let m=[];for(let t of f)m.push(Array.from(Int32Array.from(t).sort(),t=>e[t])),yield;return m}function Mi(e,t){let n=e.length,r=Int32Array.from(e),i=new Float64Array(n);for(let a=0;a<n;a++){let n=t[r[a]];if(n!==n)return e.slice().sort((e,n)=>t[e]-t[n]||e-n);i[a]=n}let a=[0,n-1];for(;a.length;){let e=a.pop(),t=a.pop();for(;e-t>12;){let n=t+e>>>1,o,s;(i[n]<i[t]||i[n]===i[t]&&r[n]<r[t])&&(o=i[n],i[n]=i[t],i[t]=o,s=r[n],r[n]=r[t],r[t]=s),(i[e]<i[t]||i[e]===i[t]&&r[e]<r[t])&&(o=i[e],i[e]=i[t],i[t]=o,s=r[e],r[e]=r[t],r[t]=s),(i[e]<i[n]||i[e]===i[n]&&r[e]<r[n])&&(o=i[e],i[e]=i[n],i[n]=o,s=r[e],r[e]=r[n],r[n]=s);let c=i[n],l=r[n],u=t,d=e;for(;u<=d;){for(;i[u]<c||i[u]===c&&r[u]<l;)u++;for(;i[d]>c||i[d]===c&&r[d]>l;)d--;u<=d&&(o=i[u],i[u]=i[d],i[d]=o,s=r[u],r[u]=r[d],r[d]=s,u++,d--)}d-t<e-u?(a.push(u,e),e=d):(a.push(t,d),t=u)}for(let n=t+1;n<=e;n++){let e=i[n],a=r[n],o=n-1;for(;o>=t&&(i[o]>e||i[o]===e&&r[o]>a);)i[o+1]=i[o],r[o+1]=r[o],o--;i[o+1]=e,r[o+1]=a}}return Array.from(r)}function Ni(e,t){let n=new Map,r=[];for(let i of e){let e=t(i);if(e==null){r.push(i);continue}let a=n.get(e);a||n.set(e,a=[]),a.push(i)}for(let e of n.values())r.push(...e);return r}function Pi(e,t,n,r){let i=r.filter(t=>e.getAttribute(t)),a=[],o=0,s=null;for(let r=0;r<t.length;r++){let c=n[r]??null;c!==null&&(s&&s.tag===c&&s.start+s.count===o?s.count+=t[r]:a.push(s={tag:c,geometry:e,start:o,count:t[r],attributes:i})),o+=t[r]}return a}var Fi=class{constructor(){this._byTag=new Map,this._hidden=new Set}add(e){for(let n of e??[]){if(!(n.count>1))continue;let e=[];for(let r of n.attributes){let i=n.geometry.getAttribute(r);if(!(i instanceof t))continue;let a=i.itemSize;e.push({attr:i,saved:i.array.slice(n.start*a,(n.start+n.count)*a)})}if(!e.length)continue;let r=this._byTag.get(n.tag);r||this._byTag.set(n.tag,r=[]);let i={start:n.start,count:n.count,attrs:e};r.push(i),this._hidden.has(n.tag)&&this._write(i,!0,!0)}}isHidden(e){return this._hidden.has(e)}info(e){let t=this._byTag.get(e)??[];return{ranges:t.length,vertices:t.reduce((e,t)=>e+t.count,0)}}setHidden(e,t,{upload:n=!0}={}){if(this._hidden.has(e)===t)return 0;t?this._hidden.add(e):this._hidden.delete(e);let r=0;for(let i of this._byTag.get(e)??[])this._write(i,t,n),r+=i.count;return r}_write(e,t,n){for(let{attr:r,saved:i}of e.attrs){let a=r.array,o=r.itemSize,s=e.start*o,c=s+e.count*o;if(t)for(let e=o;e<c-s;){let t=Math.min(e,c-s-e);a.copyWithin(s+e,s,s+t),e+=t}else a.set(i,s);n&&r.addUpdateRange(s,c-s),r.needsUpdate=!0}}clear(){this._byTag.clear(),this._hidden.clear()}};function Ii(e){return e?(e.index?e.index.count:e.attributes.position?.count??0)/3:0}function Li(e,{pad:t=0,only:n=null}={}){e.updateWorldMatrix(!0,!1);let r;e.isInstancedMesh?(e.boundingBox||e.computeBoundingBox(),r=e.boundingBox):(e.geometry.boundingBox||e.geometry.computeBoundingBox(),r=e.geometry.boundingBox);let i=r.clone().applyMatrix4(e.matrixWorld);return t&&i.expandByScalar(t),e.userData.cullBox=i,e.frustumCulled=!0,e.intersectsFrustum=function(e){return n&&!n(e)?!1:e.intersectsBox(this.userData.cullBox)},e}var Ri=4,zi=qe/Ri,Bi=1,Vi=4,Hi=.35,Ui=.4,Wi=1e-4,Gi=311573446,Ki=2,qi=16,Ji=256,Yi={N:{key:`N`,dx:0,dz:-1,nx:0,nz:-1,rx:-1,rz:0,idx:0},E:{key:`E`,dx:1,dz:0,nx:1,nz:0,rx:0,rz:-1,idx:1},S:{key:`S`,dx:0,dz:1,nx:0,nz:1,rx:1,rz:0,idx:2},W:{key:`W`,dx:-1,dz:0,nx:-1,nz:0,rx:0,rz:1,idx:3}},Xi=[`N`,`E`,`S`,`W`],Zi={N:`S`,S:`N`,E:`W`,W:`E`},Qi=new Set([`grass`,`grass_dark`,`grass_flowers`,`dirt`,`sand`,`riverbed`,`moss_stone`]),$i=new Set([`grass`,`grass_dark`,`grass_flowers`]),ea=new Set([`dirt`,`dirt_path`,`cobblestone`,`stone_tiles`,`sand`,`farmland`,`moss_stone`]),ta={grass_dark:3,grass:2,grass_flowers:1},na=[],ra=[];for(let e=0;e<8;e++)na.push(Math.cos(e*Math.PI/4)),ra.push(Math.sin(e*Math.PI/4));var ia=[.22,.45,.8,1.25],aa=1.75,oa=8,sa=[],ca=[];for(let e=0;e<oa;e++)sa.push(Math.cos(e*Math.PI*2/oa)),ca.push(Math.sin(e*Math.PI*2/oa));var la=64,ua=48,da={stripA:1,stripB:9,brim:17,skirt:22,corner:33},fa=10,pa=6,ma=6/16,ha=3/16,ga=7/16,_a=1/16,va=`
uniform vec2 lmUnits;
uniform float lmVarSeed;
float lmVHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float lmVNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lmVHash(i), lmVHash(i + vec2(1.0, 0.0)), u.x), mix(lmVHash(i + vec2(0.0, 1.0)), lmVHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 lmVApply(vec2 d, float r, float fl) {
  d.x = fl > 0.5 ? -d.x : d.x;
  return r < 0.5 ? d : r < 1.5 ? vec2(-d.y, d.x) : r < 2.5 ? -d : vec2(d.y, -d.x);
}
vec2 lmVariedUv(vec2 uv, out mat2 A) {
  vec2 w = vec2(uv.x * lmUnits.x, -uv.y * lmUnits.y);
  vec2 pw = (floor(w * 16.0) + 0.5) / 16.0;
  vec2 o = vec2(lmVNoise(pw * 1.35 + lmVarSeed), lmVNoise(pw * 1.35 - lmVarSeed + 41.3)) - 0.5;
  o += (vec2(lmVNoise(pw * 4.1 + 7.7), lmVNoise(pw * 4.1 - 3.1)) - 0.5) * 0.35;
  vec2 cell = floor(pw + o * 0.95);
  float h = lmVHash(cell + vec2(lmVarSeed * 0.37, 11.7));
  float r = floor(h * 4.0);
  float fl = step(0.5, fract(h * 7.31));
  vec2 c = cell + 0.5;
  vec2 w2 = c + lmVApply(w - c, r, fl);
  vec2 eu = lmVApply(vec2(1.0, 0.0), r, fl);
  vec2 ev = lmVApply(vec2(0.0, -1.0), r, fl);
  A = mat2(vec2(eu.x, -eu.y), vec2(ev.x, -ev.y));
  return vec2(w2.x / lmUnits.x, -w2.y / lmUnits.y);
}
`,ya=`
#ifdef USE_MAP
  mat2 lmA;
  vec2 lmUv = lmVariedUv( vMapUv, lmA );
  vec2 lmGx = lmA * dFdx( vMapUv );
  vec2 lmGy = lmA * dFdy( vMapUv );
  vec4 sampledDiffuseColor = textureGrad( map, lmUv, lmGx, lmGy );
  diffuseColor *= sampledDiffuseColor;
#endif
`,ba=`
#if defined( USE_NORMALMAP_TANGENTSPACE ) && defined( USE_MAP )
  vec3 mapN = textureGrad( normalMap, lmUv, lmGx, lmGy ).xyz * 2.0 - 1.0;
  mapN.xy = transpose( lmA ) * mapN.xy;
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#endif
`,xa=`
#ifdef USE_ALPHAMAP
  vec4 lmDecalMask = texture2D( alphaMap, vAlphaMapUv );
  diffuseColor.a *= lmDecalMask.g;
  diffuseColor.rgb *= lmDecalMask.r * ( 255.0 / 170.0 );
#endif
`,Sa=`
uniform float uLmBounce;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
`,Ca=`
#include <lights_fragment_maps>
{
  vec3 lmWN = inverseTransformDirection( normalize( vNormal ), viewMatrix );
  float lmSide = clamp( 1.0 - abs( lmWN.y ), 0.0, 1.0 );
  irradiance += uSunColor * ( max( uSunDirection.y, 0.0 ) * 0.44 * uLmBounce * lmSide );
}
`;function wa(e,t){return .0015+.0025*(ta[e]??0)+5e-4*t}function Ta(e){if(!e)return 0;let t=e.charCodeAt(0);return t>=48&&t<=57?t-48:t>=97&&t<=122?t-87:t>=65&&t<=90?t-55:0}function Ea(e,t,n,r,i){let a=Ta(n),o=!!t.water;return{char:e,type:t,level:a,h:a*qe,walkable:t.walkable??!o,i:r,j:i,water:o,stairs:l(Yi,t.stairs)?t.stairs:null,blocked:!1,waterSurface:null,waterSource:null}}function Da(e,t,n){return e===`N`?1-n:e===`S`?n:e===`E`?t:1-t}var Oa=class{constructor(e=!1){this.pos=[],this.nrm=[],this.uv=[],this.uv1=e?[]:null,this.col=[],this.idx=[],this.count=0}v(e,t,n,r,i,a,o,s,c,l,u,d=0,f=0){return this.pos.push(e,t,n),this.nrm.push(r,i,a),this.uv.push(o,s),this.col.push(c,l,u),this.uv1&&this.uv1.push(d,f),this.count++}quad(e,t,n,r){this.idx.push(e,t,n,e,n,r)}quadN(e,t,n,r,i,a,o){let s=this.pos,c=s[e*3],l=s[e*3+1],u=s[e*3+2],d=s[t*3]-c,f=s[t*3+1]-l,p=s[t*3+2]-u,m=s[n*3]-c,h=s[n*3+1]-l,g=s[n*3+2]-u,_=f*g-p*h,v=p*m-d*g,y=d*h-f*m;_*i+v*a+y*o>=0?this.idx.push(e,t,n,e,n,r):this.idx.push(e,n,t,e,r,n)}toGeometry(){let e=new Ae;return e.setAttribute(`position`,new z(this.pos,3)),e.setAttribute(`normal`,new z(this.nrm,3)),e.setAttribute(`uv`,new z(this.uv,2)),this.uv1&&e.setAttribute(`uv1`,new z(this.uv1,2)),e.setAttribute(`color`,new z(this.col,3)),e.setIndex(this.count>65535?new rt(this.idx,1):new o(this.idx,1)),e.computeBoundingBox(),e.computeBoundingSphere(),e}};function ka(e=1){let t=new nt(la,ua,[0,0,0,255]),n=(e,n,r)=>t.set(e,n,[O(Math.round(r),0,255),255,0,255]),r=(t,n,r=0)=>a(t,n,e+r),i=(t,n,r)=>g(t/8,n,e+r,8);for(let e=0;e<2;e++){let t=e?da.stripB:da.stripA,a=new Int8Array(la),o=new Uint8Array(la);for(let t=0;t<la;t++){let n=2+Math.round(i(t,e*7.3,11)*2.4);r(t,e,3)<.3&&(o[t]=1,n+=1+ +(r(t,e,5)<.45)),a[t]=O(n,1,6)}for(let i=0;i<la;i++){let s=a[i],c=Math.max(a[(i+la-1)%la],a[(i+1)%la]);for(let a=0;a<s;a++){let l=170;a===s-1?l=o[i]&&s>c?212:136:a===s-2?l=o[i]&&s>c?192:158:a===0&&r(i,e,9)<.2&&(l=185),n(i,t+a,l)}}}for(let e=0;e<la;e++){n(e,da.brim,r(e,1,21)<.25?196:180);let t=r(e,2,21)<.8;t&&n(e,da.brim+1,164),t&&r(e,3,21)<.42&&n(e,da.brim+2,140)}for(let e=0;e<la;e++){let t=2+Math.round(i(e,3.7,31)*2.6),a=r(e,4,31)<.34;a&&(t+=1+ +(r(e,5,31)<.5)+ +(r(e,6,31)<.25)),t=O(t,2,7);for(let i=0;i<t;i++){let o=y(178,118,i/6);i===t-1?o=a?150:88:i===0?o=190:r(e,i,37)<.12&&(o+=22),n(e,da.skirt+i,o)}}let o=da.corner;for(let i=0;i<pa;i++){let s=i*fa+1,c=3.4+r(i,7,41)*2;for(let t=0;t<8;t++)for(let r=0;r<8;r++){let l=Math.atan2(t+.5,r+.5),u=(a(Math.floor(l*6),i,e+43)-.5)*2.2,d=Math.hypot(r+.5,t+.5),f=c+u;d<f&&n(s+r,o+t,d>f-1?136:170)}for(let e=0;e<8;e++)t.set(s+e,o-1,t.get(s+e,o));for(let e=-1;e<8;e++)t.set(s-1,o+e,t.get(s,o+Math.max(0,e)))}for(let e of[da.stripA,da.stripB,da.brim,da.skirt])for(let n=0;n<la;n++)t.set(n,e-1,t.get(n,e));return t}var Aa=class{constructor(e,t={}){let{textures:n,seed:r=e?.name==null?Gi:le(String(e.name)),baseDepth:i=2,chunkSize:a=32,uvVariation:o=!0,fringes:s=!0,overhangs:c=!0,aoStrength:l=1.1,tintStrength:d=1,sideVariation:f=!1,wallBounce:p=1,deferBuild:m=!1}=t;if(!n)throw Error(`TileMap: opts.textures (TextureLibrary) is required`);this.textures=n,this.map=e,this.name=e.name??``,this.seed=r>>>0,this.options={baseDepth:i,chunkSize:a,uvVariation:o,fringes:s,overhangs:c,aoStrength:l,tintStrength:d,sideVariation:f},this._bounceUniform={value:p};let h=e.tiles??[],g=e.heights??[];this.depth=h.length,this.width=h.reduce((e,t)=>Math.max(e,t.length),0),this.bounds={minX:0,maxX:this.width,minZ:0,maxZ:this.depth},this._tiles=Array(this.width*this.depth).fill(null);let _=e.legend??{},v=new Set,y=1/0,b=-1/0;for(let e=0;e<this.depth;e++){let t=h[e],n=g[e]??``;for(let r=0;r<this.width;r++){let i=t[r]??` `,a=_[i];if(!a){i!==` `&&!v.has(i)&&(v.add(i),console.warn(`[TileMap] legend has no entry for "${i}" (treated as void)`));continue}if(a.void)continue;let o=Ea(i,a,n[r],r,e),s=o.h;this._tiles[e*this.width+r]=o,y=Math.min(y,s),b=Math.max(b,s+(o.stairs?qe:0))}}Number.isFinite(y)||(y=0,b=0),this.minHeight=y,this.maxHeight=b,this.baseY=y-i,this.waterLevel=e.waterLevel??Ui;for(let e of this._tiles){if(!e||!e.water)continue;let t=this._computeWaterSurface(e,this.waterLevel);e.waterSurface=t.level,e.waterSource=t.source}this.colliders=[],this._cgrid=null,this._cgridDirty=!0,this.walkSurfaces=[],this.object=new u,this.object.name=`TileMap${this.name?`:${this.name}`:``}`,this._materials=new Map,this._builders=new Map,this._maskTexture=null,this._tmpPush={x:0,z:0},this._loose=0,this._tmpUV={u:0,v:0},this._tmpTint=[1,1,1],m||this._build()}tileAt(e,t){return e=Math.floor(e),t=Math.floor(t),e>=0&&t>=0&&e<this.width&&t<this.depth?this._tiles[t*this.width+e]:null}worldToTile(e,t,n={i:0,j:0}){return n.i=Math.floor(e),n.j=Math.floor(t),n}tileCenter(e,t,n=new p){let r=e+.5,i=t+.5;return n.set(r,this.getHeight(r,i),i)}forEachTile(e){for(let t=0;t<this.depth;t++)for(let n=0;n<this.width;n++){let r=this._tiles[t*this.width+n];r&&e(n,t,r)}}getHeight(e,t){let n=this._walkHeight(e,t);if(n!==null)return n;let r=Math.floor(e),i=Math.floor(t),a=this.tileAt(r,i);return a?a.stairs?this._stairRamp(a,e-r,t-i):a.h:this.baseY}getWaterSurface(e,t){let n=this.tileAt(Math.floor(e),Math.floor(t));return n&&n.water?n.waterSurface:null}waterSurfaceOf(e,t=this.waterLevel){return this._computeWaterSurface(e,t).level}_computeWaterSurface(e,t){let n=e.type;return typeof n.waterLevel==`number`?{level:n.waterLevel,source:`legend`}:typeof n.waterDepth==`number`?{level:e.h+n.waterDepth,source:`legend`}:t>e.h+.02?{level:t,source:`global`}:{level:e.h+Hi,source:`auto`}}_stairRamp(e,t,n){let r=Da(e.stairs,t,n);return O(e.h+zi*.5+r*qe,e.h,e.h+qe)}_topAt(e,t,n){if(!e.stairs)return e.h;let r=Math.min(3,Math.floor(Da(e.stairs,t,n)*Ri));return e.h+(r+1)*zi}_surface(e,t){let n=Math.floor(e),r=Math.floor(t),i=this.tileAt(n,r);return i?this._topAt(i,e-n,t-r):this.baseY}_walkHeight(e,t){let n=this.walkSurfaces,r=null;for(let i=0;i<n.length;i++){let a=n[i];e>=a.minX&&e<=a.maxX&&t>=a.minZ&&t<=a.maxZ&&(r===null||a.y>r)&&(r=a.y)}return r}isWalkable(e,t){if(e<0||t<0||e>this.width||t>this.depth)return!1;if(this._walkHeight(e,t)===null){let n=this.tileAt(Math.floor(e),Math.floor(t));if(!n||!n.walkable)return!1}return!this._pointInCollider(e,t)}addCollider(e){return e&&!this.colliders.includes(e)&&(this.colliders.push(e),this._cgridDirty=!0),e}removeCollider(e){let t=this.colliders.indexOf(e);t>=0&&(this.colliders.splice(t,1),this._cgridDirty=!0)}collidersChanged(){this._cgridDirty=!0}queryColliders(e,t,n,r,i=[]){i.length=0;let a=this.colliders,o=this._colliderGrid();if(!o){for(let e=0;e<a.length;e++)i.push(a[e]);return i}let s=++o.stamp,c=o.scratch;c.length=0;let l=Math.max(0,Math.floor((e-o.ox)/Ki)),u=Math.min(o.nx-1,Math.floor((n-o.ox)/Ki)),d=Math.max(0,Math.floor((t-o.oz)/Ki)),f=Math.min(o.nz-1,Math.floor((r-o.oz)/Ki));for(let e=d;e<=f;e++)for(let t=l;t<=u;t++){let n=o.cells[e*o.nx+t];n&&this._collectIndices(o,n,s,c)}this._collectIndices(o,o.always,s,c),c.length>1&&c.sort((e,t)=>e-t);for(let e=0;e<c.length;e++)i.push(a[c[e]]);return i}_collectIndices(e,t,n,r){for(let i=0;i<t.length;i++){let a=t[i];e.mark[a]!==n&&(e.mark[a]=n,r.push(a))}}_colliderGrid(){let e=this.colliders;if(e.length<qi)return null;let t=this._cgrid;if(t&&!this._cgridDirty&&t.count===e.length)return t;let n=Math.max(1,Math.ceil((this.width+32)/Ki)),r=Math.max(1,Math.ceil((this.depth+32)/Ki));t={ox:-16,oz:-16,nx:n,nz:r,cells:Array(n*r).fill(null),always:[],count:e.length,mark:new Uint32Array(e.length),stamp:0,scratch:[]};for(let i=0;i<e.length;i++){let a=e[i];if(!a)continue;let o,s,c,l;a.type===`circle`?(o=a.x-a.r,s=a.x+a.r,c=a.z-a.r,l=a.z+a.r):(o=a.minX,s=a.maxX,c=a.minZ,l=a.maxZ);let u=Math.floor((o- -16)/Ki),d=Math.floor((s- -16)/Ki),f=Math.floor((c- -16)/Ki),p=Math.floor((l- -16)/Ki);if(a.dynamic||!(Number.isFinite(u)&&Number.isFinite(d)&&Number.isFinite(f)&&Number.isFinite(p))||u<0||f<0||d>=n||p>=r||(d-u+1)*(p-f+1)>Ji){t.always.push(i);continue}for(let e=f;e<=p;e++)for(let r=u;r<=d;r++){let a=e*n+r;(t.cells[a]??=[]).push(i)}}return this._cgrid=t,this._cgridDirty=!1,t}_nextPush(e,t,n,r,i){let a=1/0,o=Math.max(0,Math.floor((t-r-e.ox)/Ki)),s=Math.min(e.nx-1,Math.floor((t+r-e.ox)/Ki)),c=Math.max(0,Math.floor((n-r-e.oz)/Ki)),l=Math.min(e.nz-1,Math.floor((n+r-e.oz)/Ki));for(let u=c;u<=l;u++)for(let c=o;c<=s;c++){let o=e.cells[u*e.nx+c];o&&(a=this._firstPush(o,t,n,r,i,a))}return a=this._firstPush(e.always,t,n,r,i,a),a===1/0?-1:a}_firstPush(e,t,n,r,i,a){let o=this.colliders;for(let s=0;s<e.length;s++){let c=e[s];if(c<=i||c>=a)continue;let l=o[c];if(l.type===`circle`){let e=t-l.x,i=n-l.z,o=l.r+r;e*e+i*i<o*o&&(a=c)}else{let e=t-O(t,l.minX,l.maxX),i=n-O(n,l.minZ,l.maxZ),o=e*e+i*i;(o===0||o<r*r)&&(a=c)}}return a}blockTile(e,t){let n=this.tileAt(e,t);n&&(n.blocked=!0,n.walkable=!1)}unblockTile(e,t){let n=this.tileAt(e,t);n&&(n.blocked=!1,n.walkable=n.type.walkable??!n.water)}addWalkSurface(e){return e&&!this.walkSurfaces.includes(e)&&this.walkSurfaces.push(e),e}removeWalkSurface(e){let t=this.walkSurfaces.indexOf(e);t>=0&&this.walkSurfaces.splice(t,1)}_pointInCollider(e,t){let n=this.colliders,r=this._colliderGrid();if(r){let n=Math.floor((e-r.ox)/Ki),i=Math.floor((t-r.oz)/Ki),a=n>=0&&i>=0&&n<r.nx&&i<r.nz?r.cells[i*r.nx+n]:null;return!!a&&this._pointInList(e,t,a)||this._pointInList(e,t,r.always)}for(let r=0;r<n.length;r++){let i=n[r];if(i.type===`circle`){let n=e-i.x,r=t-i.z;if(n*n+r*r<i.r*i.r)return!0}else if(e>i.minX&&e<i.maxX&&t>i.minZ&&t<i.maxZ)return!0}return!1}_pointInList(e,t,n){let r=this.colliders;for(let i=0;i<n.length;i++){let a=r[n[i]];if(a.type===`circle`){let n=e-a.x,r=t-a.z;if(n*n+r*r<a.r*a.r)return!0}else if(e>a.minX&&e<a.maxX&&t>a.minZ&&t<a.maxZ)return!0}return!1}_standHeight(e,t,n,r){let i=this._walkHeight(e,t);if(i===null){let n=Math.floor(e),r=Math.floor(t),a=this.tileAt(n,r);if(!a||!a.walkable)return NaN;i=a.stairs?this._stairRamp(a,e-n,t-r):a.h}return Math.abs(i-n)>r?NaN:i}_canOccupy(e,t,n,r,i){if(e-n<0||t-n<0||e+n>this.width||t+n>this.depth)return!1;let a=this._standHeight(e,t,r,i);if(a!==a)return!1;for(let r=0;r<oa;r++){let o=this._standHeight(e+sa[r]*n,t+ca[r]*n,a,i);if(o!==o)return!1}return!0}_occupy(e,t,n,r,i){if(!this._loose)return this._canOccupy(e,t,n,r,i);if(e-n<0||t-n<0||e+n>this.width||t+n>this.depth)return!1;let a=this._walkHeight(e,t),o=!0;if(a===null){let n=Math.floor(e),r=Math.floor(t),i=this.tileAt(n,r);if(!i)return!1;a=i.stairs?this._stairRamp(i,e-n,t-r):i.h,o=i.walkable}return this._loose===1?o&&Math.abs(a-r)<=i:a-r<=i}_pushOut(e,t,n,r){let i=this.colliders,a=this._colliderGrid();for(let r=0;r<3;r++){let r=!1;for(let o=a?this._nextPush(a,e,t,n,-1):0;a?o>=0:o<i.length;o=a?this._nextPush(a,e,t,n,o):o+1){let a=i[o];if(a.type===`circle`){let i=e-a.x,o=t-a.z,s=a.r+n,c=i*i+o*o;if(c>=s*s)continue;let l=Math.sqrt(c);l<1e-6&&(i=0,o=1,l=1),e=a.x+i/l*s,t=a.z+o/l*s,r=!0}else{let i=O(e,a.minX,a.maxX),o=O(t,a.minZ,a.maxZ),s=e-i,c=t-o,l=s*s+c*c;if(l===0){let i=e-a.minX,o=a.maxX-e,s=t-a.minZ,c=a.maxZ-t,l=Math.min(i,o,s,c);l===i?e=a.minX-n:l===o?e=a.maxX+n:t=l===s?a.minZ-n:a.maxZ+n,r=!0}else if(l<n*n){let a=Math.sqrt(l);e=i+s/a*n,t=o+c/a*n,r=!0}}}if(!r)break}return r.x=e,r.z=t,r}move(e,t,n,r=.3,i=.55,a={x:0,z:0}){let o=e.x,s=e.z,c=Math.hypot(t,n);if(c>1e-9){let e=Math.max(1,Math.ceil(c/Math.max(.04,r*.5))),a=t/e,l=n/e,u=this.getHeight(o,s),d=this._tmpPush;this._loose=0,this._canOccupy(o,s,r,u,i)||(this._loose=Number.isNaN(this._standHeight(o,s,u,i))?2:1);for(let t=0;t<e;t++){let e,t;if(this._loose&&this._canOccupy(o,s,r,u,i)&&(this._loose=0),this._occupy(o+a,s+l,r,u,i))e=o+a,t=s+l;else if(a!==0&&this._occupy(o+a,s,r,u,i))e=o+a,t=s;else if(l!==0&&this._occupy(o,s+l,r,u,i))e=o,t=s+l;else break;if(this.colliders.length&&(this._pushOut(e,t,r,d),(d.x!==e||d.z!==t)&&(this._occupy(d.x,d.z,r,u,i)?(e=d.x,t=d.z):(e=o,t=s))),e===o&&t===s)break;o=e,s=t,u=this.getHeight(o,s)}}return a.x=o,a.z=s,a}_topUV(e,t,n,r,i){return i.u=t/r[0],i.v=-n/r[1],i}_varies(e){if(!this.options.uvVariation||!Qi.has(e))return!1;let t=this.textures.meta(e).units;return Math.abs(t[0]-t[1])<1e-6}_patchMaterial(e,t,n,r){let i=n?this.textures.meta(t).units:null,a=this.seed%997*.731+3.17,o=this._bounceUniform;e.onBeforeCompile=e=>{e.uniforms.uLmBounce=o,e.uniforms.uSunColor=Q.uSunColor,e.uniforms.uSunDirection=Q.uSunDirection;let t=e.fragmentShader.replace(`#include <common>`,`#include <common>\n${Sa}${n?va:``}`).replace(`#include <lights_fragment_maps>`,Ca);n&&(e.uniforms.lmUnits={value:new F(i[0],i[1])},e.uniforms.lmVarSeed={value:a},t=t.replace(`#include <map_fragment>`,ya).replace(`#include <normal_fragment_maps>`,ba)),r&&(t=t.replace(`#include <alphamap_fragment>`,xa)),e.fragmentShader=t},e.customProgramCacheKey=()=>`luminati-tilemap${n?`-var`:``}${r?`-decal`:``}`}get wallBounce(){return this._bounceUniform.value}set wallBounce(e){this._bounceUniform.value=e}_tint(e,t,n=1){let r=this.options.tintStrength*n,i=(ct(e*.11,t*.11,this._tintOptsA??={octaves:3,seed:this.seed+7})-.5)*2.6,a=(ct(e*.23+17.3,t*.23,this._tintOptsB??={octaves:2,seed:this.seed+13})-.5)*2.2,o=O(i,-1,1)*r,s=1+O(a,-1,1)*.045*r,c=this._tmpTint;return c[0]=(1+.045*o)*s,c[1]=(1+.012*o)*s,c[2]=(1-.06*o)*s,c}_sideTint(e,t,n,r,i){let a=this.options.tintStrength,o=e*.9+n*.9,s=(ct(o*.38+3.1,t*.55,{octaves:3,seed:this.seed+17})-.5)*2.4,c=(ct(o*.13,t*.2+9.7,{octaves:2,seed:this.seed+19})-.5)*2.2,l=1+O(s,-1,1)*.11*a,u=O(c,-1,1)*a,d=this._tmpTint;if(d[0]=(1+.05*u)*l,d[1]=(1+.015*u)*l,d[2]=(1-.06*u)*l,i){let e=(1-de(.1,.75,r-t))*.5*a;d[0]*=1-.14*e,d[1]*=1+.05*e,d[2]*=1-.2*e}return d}_wetness(e,t,n){let r=Math.floor(e),i=Math.floor(t),a=1e9;for(let o=-1;o<=1;o++)for(let s=-1;s<=1;s++){let c=this.tileAt(r+s,i+o);if(!c||!c.water||c.waterSurface===null||n-c.waterSurface>.4||n<c.waterSurface-.01)continue;let l=Math.max(c.i-e,0,e-(c.i+1)),u=Math.max(c.j-t,0,t-(c.j+1));a=Math.min(a,Math.hypot(l,u))}return a>.35?0:1-de(0,.35,a)}_aoTop(e,t,n){let r=0;for(let i=0;i<8;i++){let a=0;for(let r=0;r<ia.length;r++){let o=ia[r],s=this._surface(e+na[i]*o,t+ra[i]*o)-n;if(s>.02){let e=s/Math.sqrt(o*o+s*s)*(1-o/aa);e>a&&(a=e)}}r+=a}return O(1-this.options.aoStrength*r/8,.28,1)}_aoWall(e,t,n,r,i,a,o){let s=1;s*=a?y(.24,1,de(0,2.8,t-this.baseY)):y(.58,1,de(0,1.15,t-i));let c=e+r.nx*.14,l=n+r.nz*.14,u=0;for(let e=-1;e<=1;e+=2)for(let n=0;n<2;n++){let i=n===0?.18:.42;if(this._surface(c+r.rx*e*i,l+r.rz*e*i)>t+.02){u+=n===0?.26:.14;break}}return s*=1-Math.min(.45,u),o!==null&&(s*=y(.66,1,de(.02,.4,o-t))),O(s,.2,1)}_builder(e,t,n=!1){let r=this.options.chunkSize,i=`${Math.floor(t.i/r)},${Math.floor(t.j/r)}`,a=`${e}@${i}`,o=this._builders.get(a);return o||(o=new Oa(n),o.key=e,o.chunk=i,this._builders.set(a,o)),o}_terrainMaterial(e,t=!1){let n=`terrain:${e}${t?`:var`:``}`,r=this._materials.get(n);if(r)return r;let i=this.textures,a=i.normal(e),o=typeof i.pixels==`function`&&i.pixels(e)?.normalScale||.6;return r=new Be({map:i.get(e),vertexColors:!0}),a&&(r.normalMap=a,r.normalScale=new F(o,o)),r.name=`TileMap:${e}${t?`:var`:``}`,this._patchMaterial(r,e,t,!1),this._materials.set(n,r),r}_maskTex(){if(!this._maskTexture){this._maskPixels=ka(this.seed+9001);let e=this._maskPixels.toTexture({wrap:`repeat`,mipmaps:!1,srgb:!1,name:`TileMap:decalMask`});e.channel=1,this._maskTexture=e}return this._maskTexture}_decalMaterial(e,t=!1){let n=`decal:${e}${t?`:var`:``}`,r=this._materials.get(n);if(r)return r;let i=this.textures,a=i.normal(e),o=typeof i.pixels==`function`&&i.pixels(e)?.normalScale||.6;return r=new Be({map:i.get(e),alphaMap:this._maskTex(),alphaTest:.5,vertexColors:!0,side:2,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),a&&(r.normalMap=a,r.normalScale=new F(o,o)),r.name=`TileMap:decal:${e}${t?`:var`:``}`,this._patchMaterial(r,e,t,!0),this._materials.set(n,r),r}_build(){ki(this.buildSteps())}*buildSteps(){let e=this.width;for(let t=0;t<this.depth;t++)for(let n=0;n<e;n++){let r=this._tiles[t*e+n];r&&(this._emitTile(r),yield)}if(this.options.fringes)for(let t=0;t<this.depth;t++)for(let n=0;n<e;n++){let r=this._tiles[t*e+n];r&&(this._emitFringesAt(n,t,r),yield)}yield*this._flushBuilderSteps()}_emitTile(e){e.stairs?this._emitStairs(e):this._emitTop(e);for(let t of Xi)this._emitSides(e,Yi[t])}_flushBuilders(){return ki(this._flushBuilderSteps())}*_flushBuilderSteps(){let e=[];for(let t of this._builders.values()){if(!t.count)continue;let[n,r]=t.key.split(`:`),i=n.endsWith(`X`),a=i?n.slice(0,-1):n,o=a===`fringe`||a===`brim`||a===`skirt`,s=!i&&(a===`top`||a===`fringe`||a===`brim`)&&this._varies(r),c=o?this._decalMaterial(r,s):this._terrainMaterial(r,s),l=new R(t.toGeometry(),c);l.name=t.key,l.castShadow=a!==`fringe`&&a!==`top`,l.receiveShadow=!0,l.matrixAutoUpdate=!1,l.userData.kind=a,l.userData.chunk=t.chunk,o&&(l.renderOrder=1),e.push(l),yield}e.sort((e,t)=>e.renderOrder-t.renderOrder||(e.name<t.name?-1:1));for(let t of e)this.object.add(t);return this.object.updateMatrixWorld(!0),this._builders.clear(),e}consolidateChunks(e={}){return ki(this.consolidateChunkSteps(e))}*consolidateChunkSteps({maxTriangles:e=48e3,maxExtent:t=1/0,minTriangles:n=0}={}){let r=this.options.chunkSize,i=new Map;for(let e of this.object.children){if(!e.isMesh||e.userData.chunks)continue;let t=`${e.name}|${e.material.uuid}|${+e.castShadow}|${e.renderOrder}`,n=i.get(t);n||i.set(t,n=[]),n.push(e)}let a=this.object.children.length,o=e=>e.userData.chunk.split(`,`).map(e=>(Number(e)+.5)*r);for(let r of i.values()){if(r.length<2)continue;let i=Ai(r,{x:e=>o(e)[0],z:e=>o(e)[1],weight:e=>Ii(e.geometry),maxWeight:e,maxExtent:t,minWeight:n});for(let e of i){if(e.length<2)continue;let t=Di(e.map(e=>e.geometry),!1);if(!t)continue;let n=e[0],r=new R(t,n.material);r.name=n.name,r.castShadow=n.castShadow,r.receiveShadow=n.receiveShadow,r.matrixAutoUpdate=!1,r.renderOrder=n.renderOrder,r.userData.kind=n.userData.kind,r.userData.chunks=e.map(e=>e.userData.chunk);for(let t of e)t.removeFromParent(),t.geometry.dispose();this.object.add(r),yield}}let s=[...this.object.children].sort((e,t)=>e.renderOrder-t.renderOrder||(e.name<t.name?-1:+(e.name>t.name)));this.object.clear();for(let e of s)this.object.add(e);return this.object.updateMatrixWorld(!0),a-this.object.children.length}rebuildRect(e,t){let n=this.updateTiles(e,t,{rebase:!1});return n?(this.rebuildChunks(n),n):null}updateTiles(e,t,{rebase:n=!0}={}){let r=this.width,i=this.depth,a=e?.tiles??[];if(a.length!==i||a.reduce((e,t)=>Math.max(e,t.length),0)!==r||(e.waterLevel??Ui)!==this.waterLevel)return null;let o=Math.max(0,Math.floor(t.minI)),s=Math.min(r-1,Math.floor(t.maxI)),c=Math.max(0,Math.floor(t.minJ)),l=Math.min(i-1,Math.floor(t.maxJ));if(s<o||l<c)return[];let u=e.legend??{},d=e.heights??[],f=new Map;for(let e=c;e<=l;e++)for(let t=o;t<=s;t++){let n=a[e][t]??` `,i=u[n];f.set(e*r+t,i&&!i.void?Ea(n,i,(d[e]??``)[t],t,e):null)}let p=1/0,m=-1/0;for(let e=0;e<this._tiles.length;e++){let t=f.has(e)?f.get(e):this._tiles[e];t&&(p=Math.min(p,t.h),m=Math.max(m,t.h+(t.stairs?qe:0)))}if(!Number.isFinite(p)||!n&&p<this.baseY+this.options.baseDepth-Wi)return null;this.map=e;for(let[e,t]of f)if(this._tiles[e]=t,t&&t.water){let e=this._computeWaterSurface(t,this.waterLevel);t.waterSurface=e.level,t.waterSource=e.source}this.minHeight=p,this.maxHeight=m;let h=this.options.chunkSize,g=p-this.options.baseDepth;if(n&&Math.abs(g-this.baseY)>Wi){this.baseY=g;let e=[];for(let t=0;t*h<i;t++)for(let n=0;n*h<r;n++)e.push(`${n},${t}`);return e}let _=Math.max(0,Math.floor((o-2)/h)),v=Math.min(Math.floor((r-1)/h),Math.floor((s+2)/h)),y=Math.max(0,Math.floor((c-2)/h)),b=Math.min(Math.floor((i-1)/h),Math.floor((l+2)/h)),x=[];for(let e=y;e<=b;e++)for(let t=_;t<=v;t++)x.push(`${t},${e}`);return x}rebuildChunks(e){let t=this.width,n=this.depth,r=this.options.chunkSize,i=new Set(e);if(!i.size)return[];let a=!0;for(;a;){a=!1;for(let e of this.object.children){let t=e.userData.chunks;if(t&&t.some(e=>i.has(e)))for(let e of t)i.has(e)||(i.add(e),a=!0)}}for(let e of[...this.object.children])e.isMesh&&(i.has(e.userData.chunk)||e.userData.chunks?.some(e=>i.has(e)))&&(e.removeFromParent(),e.geometry.dispose());let o=[...i].map(e=>e.split(`,`).map(Number)).filter(([e,i])=>e>=0&&i>=0&&e*r<t&&i*r<n);o.sort((e,t)=>e[1]-t[1]||e[0]-t[0]);for(let[e,i]of o){let a=i*r,o=Math.min(n,a+r),s=e*r,c=Math.min(t,s+r);for(let e=a;e<o;e++)for(let n=s;n<c;n++){let r=this._tiles[e*t+n];r&&(this._emitTile(r),this.options.fringes&&this._emitFringesAt(n,e,r))}}return this._flushBuilders()}*rebuildChunkSteps(e){let t=this.width,n=this.depth,r=this.options.chunkSize,[i,a]=e.split(`,`).map(Number);if(!(i>=0&&a>=0&&i*r<t&&a*r<n))return[];let o=new Map,s=this._builders,c=a*r,l=Math.min(n,c+r),u=i*r,d=Math.min(t,u+r);for(let e=c;e<l;e++){this._builders=o;try{for(let n=u;n<d;n++){let r=this._tiles[e*t+n];r&&(this._emitTile(r),this.options.fringes&&this._emitFringesAt(n,e,r))}}finally{this._builders=s}e<l-1&&(yield)}for(let t of[...this.object.children])t.isMesh&&t.userData.chunk===e&&(t.removeFromParent(),t.geometry.dispose());this._builders=o;try{return this._flushBuilders()}finally{this._builders=s}}_emitTop(e){let t=e.type.top;if(!t)return;let n=this.textures.meta(t).units,r=this._builder(`${e.type.uvVariation===!1?`topX`:`top`}:${t}`,e),i=this._tmpUV,a=r.count,o=e.water?.4:1;for(let t=0;t<=Vi;t++)for(let a=0;a<=Vi;a++){let s=e.i+a/Vi,c=e.j+t/Vi;this._topUV(e,s,c,n,i);let l=this._aoTop(s,c,e.h),u=this._tint(s,c,o),d=e.water?0:this._wetness(s,c,e.h)*.2;r.v(s,e.h,c,0,1,0,i.u,i.v,u[0]*l**1.08*(1-d*1.1),u[1]*l*(1-d),u[2]*l**.9*(1-d*.6))}for(let e=0;e<Vi;e++)for(let t=0;t<Vi;t++){let n=a+e*5+t;r.quad(n,n+5,n+5+1,n+1)}}_emitStairs(e){let t=e.type.top;if(!t)return;let n=e.stairs;Yi[n];let r=this.textures.meta(t).units,i=e.type.riser||t,a=this.textures.meta(i).units,o=this._builder(`top:${t}`,e),s=this._builder(`side:${i}`,e),c=this._tmpUV;for(let t=0;t<Ri;t++){let i=e.h+(t+1)*zi,l=t/Ri,u=(t+1)/Ri,d=0,f=1,p=0,m=1;n===`N`?(p=1-u,m=1-l):n===`S`?(p=l,m=u):n===`E`?(d=l,f=u):(d=1-u,f=1-l);let h=n===`N`||n===`S`?Vi:1,g=n===`N`||n===`S`?1:Vi,_=o.count;for(let a=0;a<=g;a++)for(let s=0;s<=h;s++){let u=e.i+y(d,f,s/h),_=e.j+y(p,m,a/g);this._topUV(e,u,_,r,c);let v=Da(n,u-e.i,_-e.j),b=Math.abs(v-l)<1e-4,x=this._aoTop(u,_,i);!b&&t<3&&(x*=.68);let S=b?1.22:1;ja(o,u,i,_,0,1,0,c.u,c.v,x*S)}let v=h+1;for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=_+e*v+t;o.quadN(n,n+v,n+v+1,n+1,0,1,0)}let b=Yi[Zi[n]],x=e.h+t*zi,S=e.i+.5,C=e.j+.5;n===`N`?C=e.j+1-l:n===`S`?C=e.j+l:S=n===`E`?e.i+l:e.i+1-l;let w=S-b.rx*.5,T=C-b.rz*.5,E=s.count;for(let e=0;e<=Vi;e++){let t=e/Vi,n=w+b.rx*t,r=T+b.rz*t,o=(n*b.rx+r*b.rz)/a[0];ja(s,n,x,r,b.nx,0,b.nz,o,x/a[1],.5),ja(s,n,i,r,b.nx,0,b.nz,o,i/a[1],.9)}for(let e=0;e<Vi;e++){let t=E+e*2;s.quadN(t,t+2,t+3,t+1,b.nx,0,b.nz)}}}_edgeProfile(e,t,n){if(!e)return n[0]=n[1]=n[2]=n[3]=this.baseY,n;if(!e.stairs||Zi[e.stairs]===t)return n[0]=n[1]=n[2]=n[3]=e.h,n;for(let r=0;r<4;r++){let i=(r+.5)/4,a,o;t===`N`?(a=i,o=.001):t===`S`?(a=i,o=.999):t===`E`?(a=.999,o=i):(a=.001,o=i),n[r]=this._topAt(e,a,o)}return n}_emitSides(e,t){let n=this.tileAt(e.i+t.dx,e.j+t.dz),r=this._edgeProfile(e,t.key,this._ep0||=[0,0,0,0]),i=this._edgeProfile(n,Zi[t.key],this._ep1||=[0,0,0,0]),a=!n,o=0;for(;o<4;){let s=o+1;for(;s<4&&Math.abs(r[s]-r[o])<Wi&&Math.abs(i[s]-i[o])<Wi;)s++;let c=r[o],l=i[o];c>l+Wi&&this._emitFace(e,t,o/4,s/4,l,c,a,n&&n.water?n.waterSurface:null),o=s}}_edgePoint(e,t,n){let r=this._ptmp||={x:0,z:0};switch(t.key){case`N`:r.x=e.i+n,r.z=e.j;break;case`S`:r.x=e.i+n,r.z=e.j+1;break;case`E`:r.x=e.i+1,r.z=e.j+n;break;default:r.x=e.i,r.z=e.j+n}return r}_emitFace(e,t,n,r,i,a,o,s=null){let c=e.type,l=c.lip||null,u=c.side||l||c.top;if(!u)return;let d=l?Math.max(i,a-Bi):a,f=$i.has(c.top)&&!e.stairs&&c.overhang!==!1,p=this.options.overhangs&&f&&l&&a-i>=.24&&Math.abs(a-e.h)<Wi,m=p?a:null;s!==null&&(s<i||s>a+.2)&&(s=null),l&&this._faceBand(e,t,n,r,d,a,l,!0,a,i,o,m,s),d>i+Wi&&this._faceBand(e,t,n,r,i,d,u,!1,a,i,o,m,s),p&&this._emitOverhang(e,t,n,r,a,a-i)}_faceBand(e,t,n,r,i,o,s,c,l,u,d,f,p=null){let m=this.textures.meta(s),h=m.units,g=this._builder(`side:${s}`,e),_=[i];for(let e=Math.floor(i/.5+1-Wi)*.5;e<o-Wi;e+=.5)e>i+Wi&&_.push(e);if(f!==null&&f-.25>i+Wi&&f-.25<o-Wi&&!_.some(e=>Math.abs(e-(f-.25))<Wi)&&_.push(f-.25),p!==null)for(let e of[p,p+.14])e>i+Wi&&e<o-Wi&&!_.some(t=>Math.abs(t-e)<Wi)&&_.push(e);_.push(o),_.sort((e,t)=>e-t);let v=0;this.options.sideVariation&&(v=Math.floor(a(e.i*4+t.idx,e.j,this.seed+303)*m.px[0])/m.px[0]);let b=this._edgePoint(e,t,n),x=b.x,S=b.z,C=this._edgePoint(e,t,r),w=C.x,T=C.z,E=x*t.rx+S*t.rz,D=w*t.rx+T*t.rz,O=E<=D?x:w,k=E<=D?S:T,A=E<=D?w:x,j=E<=D?T:S,M=Math.max(1,Math.round((r-n)*Vi)),N=g.count;for(let e=0;e<=M;e++){let n=e/M,r=y(O,A,n),i=y(k,j,n),a=(r*t.rx+i*t.rz)/h[0]+v;for(let e=0;e<_.length;e++){let n=_[e],o=c?(n-l)/h[1]+1:n/h[1],s=this._aoWall(r,n,i,t,u,d,f),m=this._sideTint(r,n,i,l,f!==null),v=p===null?0:n<=p+Wi?.3:.3*(1-de(p,p+.14,n));g.v(r,n,i,t.nx,0,t.nz,a,o,m[0]*s**1.06*(1-v),m[1]*s*(1-v*.9),m[2]*s**.92*(1-v*.6))}}let P=_.length;for(let e=0;e<M;e++)for(let t=0;t<P-1;t++){let n=N+e*P+t,r=N+(e+1)*P+t;g.quad(n,r,r+1,n+1)}}_convexEnd(e,t,n,r){let i=+(t.dx===0),a=t.dx===0?0:1,o=this._edgePoint(e,t,n<0?0:1),s=o.x+i*n*.06-t.nx*.06,c=o.z+a*n*.06-t.nz*.06;return this._surface(s,c)<r-.2}_emitOverhang(e,t,n,r,i,a){let o=e.type.top,s=this.textures.meta(o).units,c=e.type.uvVariation===!1?`X`:``,l=this._builder(`brim${c}:${o}`,e,!0),u=this._tmpUV,d=+(t.dx===0),f=t.dx===0?0:1,p=n===0&&this._convexEnd(e,t,-1,i),m=r===1&&this._convexEnd(e,t,1,i),h=ha,g=this._edgePoint(e,t,n),_=g.x,v=g.z;g=this._edgePoint(e,t,r);let b=g.x,x=g.z,S=_-(p?d*h:0),C=v-(p?f*h:0),w=b+(m?d*h:0),T=x+(m?f*h:0),E=t.dx===0?S:_,D=t.dx===0?C:v,O=t.dx===0?w:b,k=t.dx===0?T:x,A=Math.max(1,Math.round(Math.hypot(O-E,k-D)*Vi)),j=1-(da.brim-_a*16)/ua,M=1-(da.brim+ha*16)/ua,N=l.count;for(let n=0;n<=A;n++){let r=n/A,a=y(E,O,r),o=y(D,k,r),c=a*d+o*f,p=this._tint(a,o);for(let n=0;n<2;n++){let r=n?ha:-_a,d=a+t.nx*r,f=o+t.nz*r;this._topUV(e,d,f,s,u),l.v(d,i+6e-4*(t.idx+1),f,0,1,0,u.u,u.v,p[0],p[1],p[2],c/4,n?M:j)}}for(let e=0;e<A;e++){let t=N+e*2;l.quadN(t,t+1,t+3,t+2,0,1,0)}let P=Math.min(ga,a*.72),F=t.nx*ha,I=t.nz*ha,L=S*t.rx+C*t.rz,R=w*t.rx+T*t.rz,ee=(L<=R?S:w)+F,te=(L<=R?C:T)+I,ne=(L<=R?w:S)+F,re=(L<=R?T:C)+I,ie=Math.max(1,Math.round(Math.hypot(ne-ee,re-te)*Vi));l=this._builder(`skirt:${o}`,e,!0),N=l.count;for(let e=0;e<=ie;e++){let n=e/ie,r=y(ee,ne,n),a=y(te,re,n),o=(r*t.rx+a*t.rz)/s[0],c=(r-F)*d+(a-I)*f,u=this._tint(r,a);for(let e=0;e<2;e++){let n=e?i:i-P,d=1-(da.skirt+(e?0:P*16))/ua,f=e?1:.82;l.v(r,n,a,t.nx,0,t.nz,o,-n/s[1],u[0]*f,u[1]*f,u[2]*f,c/4,d)}}for(let e=0;e<ie;e++){let n=N+e*2;l.quadN(n,n+2,n+3,n+1,t.nx,0,t.nz)}}_isGrassSource(e,t){if(!e||e.stairs||e.water||e.type.fringe===!1||Math.abs(e.h-t.h)>Wi)return!1;let n=e.type.top;if(!$i.has(n))return!1;let r=t.type.top;return ea.has(r)?!0:$i.has(r)&&(ta[n]??0)>(ta[r]??0)}_emitFringes(){this.forEachTile((e,t,n)=>this._emitFringesAt(e,t,n))}_emitFringesAt(e,t,n){let r=this._tmpUV;{if(n.stairs||n.water||n.type.fringe===!1||!ea.has(n.type.top)&&!$i.has(n.type.top))return;let i=[];for(let r of Xi){let a=Yi[r],o=this.tileAt(e+a.dx,t+a.dz);i.push(this._isGrassSource(o,n)?o:null)}for(let o=0;o<4;o++){let s=i[o];if(!s)continue;let c=Yi[Xi[o]],l=s.type.top,u=this.textures.meta(l).units,d=this._builder(`fringe${s.type.uvVariation===!1?`X`:``}:${l}`,n,!0),f=+(c.dx===0),p=c.dx===0?0:1,m=a(e+c.idx*7,t,this.seed+404)<.5?da.stripA:da.stripB,h=n.h+wa(l,c.idx),g=this._edgePoint(n,c,0),_=g.x,v=g.z,y=d.count;for(let e=0;e<=Vi;e++){let t=e/Vi;for(let e=0;e<2;e++){let i=e?ma:-_a,a=_+f*t-c.nx*i,o=v+p*t-c.nz*i;this._topUV(s,a,o,u,r);let l=a*f+o*p,g=this._aoTop(a,o,n.h),y=this._tint(a,o),b=1-(m+i*16)/ua;d.v(a,h,o,0,1,0,r.u,r.v,y[0]*g**1.08,y[1]*g,y[2]*g**.9,l/4,b)}}for(let e=0;e<Vi;e++){let t=y+e*2;d.quadN(t,t+1,t+3,t+2,0,1,0)}}let o=[[-1,-1,0,3],[1,-1,0,1],[1,1,2,1],[-1,1,2,3]];for(let s=0;s<4;s++){let[c,l,u,d]=o[s];if(i[u]||i[d])continue;let f=this.tileAt(e+c,t+l);if(!this._isGrassSource(f,n))continue;let p=f.type.top,m=this.textures.meta(p).units,h=this._builder(`fringe${f.type.uvVariation===!1?`X`:``}:${p}`,n,!0),g=e+ +(c>0),_=t+ +(l>0),v=Math.floor(a(e,t,this.seed+505+s)*pa)*fa+1,y=n.h+wa(p,4),b=h.count;for(let e=0;e<2;e++)for(let t=0;t<2;t++){let i=t*ma,a=e*ma,o=g-c*i,s=_-l*a;this._topUV(f,o,s,m,r);let u=this._tint(o,s),d=this._aoTop(o,s,n.h),p=(v+(t?ma*16:0))/la,b=1-(da.corner+(e?ma*16:0))/ua;h.v(o,y,s,0,1,0,r.u,r.v,u[0]*d**1.08,u[1]*d,u[2]*d**.9,p,b)}h.quadN(b,b+2,b+3,b+1,0,1,0)}}}get stats(){let e=0,t=0,n=0;return this.object.traverse(r=>{r.isMesh&&(e++,t+=r.geometry.index.count/3,n+=r.geometry.attributes.position.count)}),{meshes:e,triangles:t,vertices:n,materials:this._materials.size}}dispose(){this.object.traverse(e=>{e.isMesh&&e.geometry.dispose()});for(let e of this._materials.values())e.dispose();this._materials.clear(),this._maskTexture?.dispose(),this._maskTexture=null,this.object.removeFromParent(),this.object.clear()}};function ja(e,t,n,r,i,a,o,s,c,l){return e.v(t,n,r,i,a,o,s,c,l**1.06,l,l**.92)}function Ma(e,t,n,r,i){let{width:a,R:o,colliders:s,maxDistance:c,maxDepth:l,maxFlow:u}=e,d=e.surf,f=e.flow,p=e.bed,m=r*i,h=new Float32Array(m).fill(NaN),g=new Float32Array(m),_=new Float32Array(m),v=new Float32Array(m),y=e.depth,b=(e,t)=>e<0||t<0||e>=a||t>=y?NaN:d[t*a+e],x=Math.floor(t/o),S=Math.floor(n/o),C=Math.floor((t+r-1)/o)-x+1,w=Math.floor((n+i-1)/o)-S+1,T=Array(Math.max(0,C*w)).fill(null);for(let e=0;e<s.length;e++){let t=s[e],n=t.type===`circle`,r=n?t.x-t.r:t.minX,i=n?t.x+t.r:t.maxX,a=n?t.z-t.r:t.minZ,o=n?t.z+t.r:t.maxZ;if(!(i>r&&o>a))continue;let c=Math.max(x,Math.floor(r)),l=Math.min(x+C-1,Math.floor(i)),u=Math.max(S,Math.floor(a)),d=Math.min(S+w-1,Math.floor(o));for(let e=u;e<=d;e++)for(let n=c;n<=l;n++){let r=b(n,e);if(r!==r)continue;let i=(e-S)*C+(n-x);(T[i]??=[]).push(t)}}for(let e=0;e<i;e++){let i=n+e,s=Math.floor(i/o),c=(i+.5)/o;for(let n=0;n<r;n++){let i=t+n,l=Math.floor(i/o),u=b(l,s);if(u!==u)continue;let d=(i+.5)/o,m=!1,y=T[(s-S)*C+(l-x)]??Na;for(let e=0;e<y.length&&!m;e++){let t=y[e];m=t.type===`circle`?(d-t.x)**2+(c-t.z)**2<t.r*t.r:d>t.minX&&d<t.maxX&&c>t.minZ&&c<t.maxZ}if(m)continue;let w=e*r+n,E=s*a+l;h[w]=u,g[w]=Math.max(0,u-p[E]),_[w]=f[E*2],v[w]=f[E*2+1]}}let E=new Float32Array(m);for(let e=0;e<i;e++)for(let t=0;t<r;t++){let n=e*r+t,a=h[n];if(a!==a){E[n]=0;continue}let o=!1;if(t>0){let e=h[n-1];e===e&&Math.abs(e-a)>.01&&(o=!0)}if(t<r-1){let e=h[n+1];e===e&&Math.abs(e-a)>.01&&(o=!0)}if(e>0){let e=h[n-r];e===e&&Math.abs(e-a)>.01&&(o=!0)}if(e<i-1){let e=h[n+r];e===e&&Math.abs(e-a)>.01&&(o=!0)}E[n]=o?.5:1e9}let D=Math.SQRT2;for(let e=0;e<i;e++)for(let t=0;t<r;t++){let n=e*r+t,i=E[n];i!==0&&(t>0&&(i=Math.min(i,E[n-1]+1)),e>0&&(i=Math.min(i,E[n-r]+1),t>0&&(i=Math.min(i,E[n-r-1]+D)),t<r-1&&(i=Math.min(i,E[n-r+1]+D))),E[n]=i)}for(let e=i-1;e>=0;e--)for(let t=r-1;t>=0;t--){let n=e*r+t,a=E[n];a!==0&&(t<r-1&&(a=Math.min(a,E[n+1]+1)),e<i-1&&(a=Math.min(a,E[n+r]+1),t<r-1&&(a=Math.min(a,E[n+r+1]+D)),t>0&&(a=Math.min(a,E[n+r-1]+D))),E[n]=a)}for(let e=0;e<m;e++)E[e]=Math.min(E[e]/o,c);Pa(E,r,i,1,2,e=>h[e]===h[e]),Pa(g,r,i,Math.max(1,o>>1),2,null),Pa(_,r,i,Math.max(1,o>>1),2,null),Pa(v,r,i,Math.max(1,o>>1),2,null);let k=new Uint8Array(m*4),A=u;for(let e=0;e<m;e++)k[e*4]=Math.round(O(E[e]/c)*255),k[e*4+1]=Math.round(O(g[e]/l)*255),k[e*4+2]=Math.round(O(_[e]/A*.5+.5)*255),k[e*4+3]=Math.round(O(v[e]/A*.5+.5)*255);return k}var Na=[];function Pa(e,t,n,r,i,a){let o=new Float32Array(e.length);for(let s=0;s<i;s++){for(let i=0;i<n;i++)for(let n=0;n<t;n++){let a=0,s=0;for(let o=-r;o<=r;o++){let r=n+o;r<0||r>=t||(a+=e[i*t+r],s++)}o[i*t+n]=a/s}for(let i=0;i<n;i++)for(let s=0;s<t;s++){let c=i*t+s;if(a&&!a(c))continue;let l=0,u=0;for(let e=-r;e<=r;e++){let r=i+e;r<0||r>=n||(l+=o[r*t+s],u++)}e[c]=l/u}}}var Fa=ve.water.map(e=>f(e)),Ia=`
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

float lmHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float lmNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lmHash(i), lmHash(i + vec2(1.0, 0.0)), u.x),
             mix(lmHash(i + vec2(0.0, 1.0)), lmHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lmBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float lmBayer4(vec2 a) { return lmBayer2(0.5 * a) * 0.25 + lmBayer2(a); }
// keep water saturated under strongly coloured light (golden hour / purple dusk fill)
vec3 lmSaturate(vec3 c, float amount) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(l), c, amount), 0.0);
}
// partially neutralise a light colour: water scatters light and keeps more of its own hue
vec3 lmNeutral(vec3 irr, float amount) {
  return mix(irr, vec3(dot(irr, vec3(0.2126, 0.7152, 0.0722))), amount);
}


vec3 lmIrradiance(vec3 nW, vec3 posW, float shadow) {
  vec3 n = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  vec3 irr = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) irr += getHemisphereLightIrradiance(hemisphereLights[i], n);
  #endif
  #if NUM_DIR_LIGHTS > 0
  for (int i = 0; i < NUM_DIR_LIGHTS; i++) irr += directionalLights[i].color * max(dot(n, directionalLights[i].direction), 0.0) * shadow;
  #endif
  #if NUM_POINT_LIGHTS > 0
  vec3 lmVp = (viewMatrix * vec4(posW, 1.0)).xyz;
  IncidentLight lmIl;
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    getPointLightInfo(pointLights[i], lmVp, lmIl);
    irr += lmIl.color * max(dot(n, lmIl.direction), 0.0);
  }
  #endif
  return irr * RECIPROCAL_PI;
}

`,La=`
attribute float aTop;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vTop;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
  vTop = aTop;
}
`,Ra=`
uniform float uTime;
uniform float uNight;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform sampler2D uShore;
uniform vec4 uShoreRect;
uniform float uMaxDist;
uniform float uMaxDepth;
uniform float uMaxFlow;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uCrest;
uniform vec3 uFoam;
uniform float uOpacity;
uniform float uShallowOpacity;
uniform float uGlint;
uniform float uFoamAmount;
uniform float uBrightness;
uniform float uDeepAt;
uniform float uReflect;
uniform float uSaturation;
uniform float uNeutral;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vTop;
${Ia}

// short horizontal ripple dashes (anisotropic value noise, two octaves)
float lmRipple(vec2 p, float t) {
  vec2 q = vec2(p.x * 1.9, p.y * 5.2);
  float n = lmNoise(q + vec2(t * 0.22, t * 0.08));
  return n * 0.62 + 0.38 * lmNoise(q * 2.3 + vec2(-t * 0.31, t * 0.17) + 17.0);
}

// Two-phase flow map: the pattern is advected along the local flow and restarted every
// PERIOD seconds with a contrast-preserving cross-fade, so it never stretches.
float lmFlowRipple(vec2 p, vec2 flow, float t) {
  const float PERIOD = 3.2;
  float ph0 = fract(t / PERIOD);
  float ph1 = fract(t / PERIOD + 0.5);
  float w0 = 1.0 - abs(2.0 * ph0 - 1.0);
  float r0 = lmRipple(p - flow * (ph0 * PERIOD), t);
  float r1 = lmRipple(p - flow * (ph1 * PERIOD) + vec2(0.37, 0.61), t);
  float r = mix(r1, r0, w0);
  float norm = inversesqrt(w0 * w0 + (1.0 - w0) * (1.0 - w0));
  return clamp((r - 0.5) * norm + 0.5, 0.0, 1.0);
}

void main() {
  #include <logdepthbuf_fragment>
  float t = uTime;
  float shadow = getShadowMask();
  float night = clamp(uNight, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 irrUp = lmNeutral(lmIrradiance(vec3(0.0, 1.0, 0.0), vWorldPos, shadow), uNeutral * (1.0 - night)) * uBrightness;
  vec3 sky = uFogColor;
  vec3 col;
  float alpha;

  if (vWorldNormal.y < 0.5) {
    // --- vertical cross-section of the water body (diorama cut / step down) ---
    vec2 axis = vec2(-vWorldNormal.z, vWorldNormal.x);
    float u = dot(vWorldPos.xz, axis);
    vec2 px = floor(vec2(u, vWorldPos.y) * 16.0);
    float below = max(0.0, vTop - (px.y + 0.5) / 16.0);
    float band = 1.6 + clamp(below / 0.3, 0.0, 1.0) * 1.9 + (lmNoise(vec2(px.x * 0.22, px.y * 0.3 + t * 0.4)) - 0.5) * 0.5;
    float q = clamp(floor(band + (lmBayer4(px) - 0.5) * 0.5), 1.0, 3.0);
    vec3 albedo = q < 1.5 ? uC1 : q < 2.5 ? uC2 : uC3;
    float wob = lmNoise(vec2(px.x * 0.35 + t * 0.6, 3.0));
    float rim = step(below, 1.1 / 16.0 + wob * 0.06);
    albedo = mix(albedo, uC1, 0.4 * step(0.78, lmNoise(vec2(px.x * 0.16 - t * 0.25, 1.3))) * (1.0 - rim));
    albedo = mix(albedo, uCrest, rim);
    vec3 irrSide = lmNeutral(lmIrradiance(normalize(vWorldNormal + vec3(0.0, 0.6, 0.0)), vWorldPos, shadow), uNeutral * (1.0 - night)) * uBrightness;
    col = albedo * mix(irrSide, irrUp, rim);
    col = mix(col, sky, 0.04);
    alpha = mix(0.95, 1.0, rim);
  } else {
    // --- surface ---
    vec2 px = floor(vWorldPos.xz * 16.0);
    vec2 pc = (px + 0.5) / 16.0;
    vec4 sh = texture2D(uShore, (pc - uShoreRect.xy) * uShoreRect.zw);
    float dist = sh.r * uMaxDist;
    float depth = min(sh.g * uMaxDepth, dist * 1.3 + 0.03);
    vec2 flow = (sh.ba * 2.0 - 1.0) * uMaxFlow;

    // depth bands: shallow teal rim → deep blue, with large slowly drifting darker patches;
    // ordered dithering only near band edges
    float dN = clamp(depth / uDeepAt, 0.0, 1.0);
    float patchN = lmNoise(pc * 0.42 + vec2(t * 0.03, -t * 0.021)) * 0.75 + lmNoise(pc * 1.3 - t * 0.05) * 0.25;
    float band = dN * 2.3 + smoothstep(0.5, 0.6, patchN) * 0.95 * dN;
    float q = clamp(floor(band + (lmBayer4(px) - 0.5) * 0.5), 0.0, 3.0);
    vec3 albedo = q < 0.5 ? uC0 : q < 1.5 ? uC1 : q < 2.5 ? uC2 : uC3;

    // pixel ripple dashes drifting with the flow
    float rp = lmFlowRipple(pc, flow, t);
    float hi = step(0.69, rp);
    float hi2 = step(0.8, rp);
    float lo = 1.0 - step(0.2, rp);
    albedo = mix(albedo, uC0, hi * (1.0 - hi2) * 0.7);
    albedo = mix(albedo, uCrest, hi2);
    albedo *= 1.0 - lo * 0.18;
    col = albedo * irrUp;

    // sky reflection (fresnel-ish, a touch stronger on crests). Stylised: weaker where the sun
    // is shadowed, so shaded water keeps its deep body colour instead of turning into a flat
    // lavender/grey veil of the (unlit, bright) horizon colour at golden hour / dusk.
    float fres = uReflect * (0.35 + 1.2 * pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0)) * mix(0.4, 1.0, shadow);
    col = mix(col, sky, clamp(fres + hi * 0.06 * mix(0.4, 1.0, shadow), 0.0, 0.6));

    // foam: broken contact rim + lines rolling toward the shore
    float fn = lmNoise(pc * 2.1 + vec2(t * 0.13, -t * 0.09));
    float contact = step(dist, (0.05 + 0.07 * fn) * uFoamAmount);
    float phase = dist * 2.3 + t * 0.3 + fn * 0.35;
    float lineMask = step(0.42, lmNoise(pc * 1.25 + vec2(-t * 0.05, t * 0.04) + 9.0));
    float lines = step(0.86, fract(phase)) * (1.0 - smoothstep(0.12, 0.75 * uFoamAmount, dist)) * lineMask;
    float foam = max(contact, lines * 0.85);
    col = mix(col, uFoam * irrUp, foam);

    // sun / moon glints: 4-point pixel stars in 4x4 px cells, HDR so they bloom
    vec3 L = normalize(uSunDirection);
    vec3 N = normalize(vec3((rp - 0.5) * 0.35, 1.0, (fn - 0.5) * 0.35));
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 10.0);
    vec2 cell = floor(px / 4.0);
    float ch = lmHash(cell * 1.37 + 3.1);
    float tt = t * (1.8 + ch * 1.6) + ch * 11.0;
    float slot = mod(floor(tt), 4096.0); // wrapped: hash inputs stay small after hours of uptime
    float life = fract(tt);
    float hs = lmHash(cell + slot * vec2(7.13, 3.71));
    vec2 gpos = 1.0 + floor(vec2(lmHash(cell + slot + 0.5), lmHash(cell - slot + 1.7)) * 2.0);
    vec2 lp = abs(px - cell * 4.0 - gpos);
    float manh = lp.x + lp.y;
    float centre = step(manh, 0.5);
    float arms = step(manh, 1.5) * (1.0 - centre) * step(0.28, life) * step(life, 0.72);
    float density = (0.045 + 0.35 * spec) * uGlint * (0.3 + 0.7 * hi);
    float glint = step(1.0 - density, hs) * (centre + arms * 0.5) * (1.0 - foam) * shadow * step(0.02, L.y);
    vec3 gcol = uSunColor * 3.0 * mix(1.0, 1.7, night) + mix(vec3(0.25, 0.22, 0.15), vec3(0.04, 0.07, 0.16), night);
    col += glint * gcol;

    alpha = mix(uShallowOpacity, uOpacity, smoothstep(0.02, 0.35, depth));
    alpha = max(alpha, max(foam, min(1.0, glint)));
  }

  col = lmSaturate(col, mix(uSaturation, 1.0, night));
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`,za=class{constructor(e,t={}){let{level:n,flow:r=[0,.3],resolution:i=8,opacity:a=.9,shallowOpacity:o=.58,glint:s=1,foam:c=1,maxDistance:l=2,maxDepth:u=1.5,brightness:d=1.15,deepAt:f=.34,reflect:p=.1,saturation:m=1.12,neutral:h=.35,deferShore:g=!1}=t;this.tileMap=e,this.level=n??e.waterLevel,this._levelOverride=n,this.flow=new F(r[0]??0,r[1]??0),this.resolution=Math.max(2,i|0),this.maxDistance=l,this.maxDepth=u;let _=e.width,v=e.depth;this._surf=new Float32Array(_*v).fill(NaN),this._flow=new Float32Array(_*v*2),this._bed=new Float64Array(_*v),this.tiles=[],this._readTiles();let y=this.maxFlow;this.uniforms=B.merge([Z.lights,Z.fog,{uShore:{value:null},uShoreRect:{value:new x(0,0,1/Math.max(1,_),1/Math.max(1,v))},uMaxDist:{value:l},uMaxDepth:{value:u},uMaxFlow:{value:y},uC0:{value:Fa[4].clone()},uC1:{value:Fa[3].clone()},uC2:{value:Fa[2].clone()},uC3:{value:Fa[1].clone()},uCrest:{value:Fa[5].clone()},uFoam:{value:Fa[6].clone().multiplyScalar(1.05)},uOpacity:{value:a},uShallowOpacity:{value:o},uGlint:{value:s},uFoamAmount:{value:c},uBrightness:{value:d},uDeepAt:{value:f},uReflect:{value:p},uSaturation:{value:m},uNeutral:{value:h}}]),this.uniforms.uTime=Q.uTime,this.uniforms.uNight=Q.uNight,this.uniforms.uSunDirection=Q.uSunDirection,this.uniforms.uSunColor=Q.uSunColor,this.uniforms.uFogColor=Q.uFogColor,this.uniforms.uFogStart=Q.uFogStart,this.material=new Me({name:`Luminati:Water`,uniforms:this.uniforms,vertexShader:La,fragmentShader:Ra,fog:!0,lights:!0,transparent:!0,depthWrite:!0}),this.geometry=this._buildGeometry(),this.object=new R(this.geometry,this.material),this.object.name=`Water`,this.object.renderOrder=w.WATER,this.object.receiveShadow=!0,this.object.castShadow=!1,this.object.matrixAutoUpdate=!1,this.object.visible=this.tiles.length>0,this.shoreTexture=null,this._colliderCount=e.colliders.length,this._colliderSig=``,this._worker=void 0,this._shoreJobs=new Map,this._shoreJobId=0,this._shoreGen=0,g||this.refresh()}_readTiles(){let e=this.tileMap,t=e.width,n=this._levelOverride;this._surf.fill(NaN),this._flow.fill(0),this._bed.fill(0),this.tiles=[],e.forEachTile((e,r,i)=>{if(!i.water)return;let a=r*t+e;this._surf[a]=n!=null&&i.waterSource===`global`?n:i.waterSurface,this._bed[a]=i.h;let o=i.type.flow,s=this.flow.x,c=this.flow.y;Array.isArray(o)?(s=o[0]??0,c=o[1]??0):typeof o==`number`&&(s*=o,c*=o),this._flow[a*2]=s,this._flow[a*2+1]=c,this.tiles.push(i)});let r=.05;for(let e=0;e<this._flow.length;e++)r=Math.max(r,Math.abs(this._flow[e]));this.maxFlow=r}refresh(){this._shoreGen++;let e=this._buildShoreTexture();this.shoreTexture?.dispose(),this.shoreTexture=e,this.uniforms.uShore.value=e,this._colliderCount=this.tileMap.colliders.length,this._colliderSig=this._waterColliderSignature()}refreshAsync(){if(typeof Worker!=`function`)return this.refresh(),Promise.resolve();let e=this.tileMap,t=this.resolution,n=Math.max(1,e.width*t),r=Math.max(1,e.depth*t),i=this.shoreInput(!0),a=e.colliders.length,o=this._waterColliderSignature();return new Promise(s=>{let c=this._newShoreWorker();this._bake?.end();let l=()=>{c?.terminate(),this._bake?.worker===c&&(this._bake=null),s()};this._bake={worker:c,end:l};let u=()=>{if(this._disposed){l();return}c?.terminate(),this.refresh(),l()};if(!c){u();return}c.onmessage=i=>{if(this._disposed){l();return}let{out:f,error:p}=i.data??{};if(p||!f||f.length!==n*r*4||n!==e.width*t||r!==e.depth*t){u();return}c.terminate(),this._bake?.worker===c&&(this._bake=null),this._shoreData=f;let m=new je(f,n,r,re,d);this._setupShoreTexture(m),this.shoreTexture?.dispose(),this.shoreTexture=m,this.uniforms.uShore.value=m,this._colliderCount=a,this._colliderSig=o,s()},c.onerror=e=>{e.preventDefault?.(),u()},c.postMessage({id:1,input:i,a0:0,b0:0,W:n,H:r})})}get shoreReach(){return Math.ceil(this.maxDistance)+1}updateTiles(){let e=this.tileMap;if(this._surf.length!==e.width*e.depth)throw Error(`Water.updateTiles: the TileMap size changed`);let t=this.maxFlow;this._readTiles(),this.uniforms.uMaxFlow.value=this.maxFlow;let n=this._buildGeometry(),r=this.geometry;return this.geometry=n,this.object.geometry=n,r.dispose(),this.object.visible=this.tiles.length>0,{flowChanged:t!==this.maxFlow,hasWater:this.tiles.length>0}}rebakeShore(e,{expand:t=!0}={}){if(!this._shoreData||!this.shoreTexture){this.refresh();return}this._updateShoreWindow(e,t),this._colliderCount=this.tileMap.colliders.length,this._colliderSig=this._waterColliderSignature()}rebakeShoreAsync(e,{expand:t=!0}={}){if(!this._shoreData||!this.shoreTexture)return this.refresh(),Promise.resolve();let n=this.shoreJob(e,{expand:t});if(!n)return Promise.resolve();let r=this._shoreWorker();if(!r)return this.rebakeShore(e,{expand:t}),Promise.resolve();this._colliderCount=this.tileMap.colliders.length,this._colliderSig=this._waterColliderSignature();let i=++this._shoreJobId;return new Promise(a=>{this._shoreJobs.set(i,{job:n,rect:e,expand:t,gen:this._shoreGen,resolve:a}),r.postMessage({id:i,input:this.shoreInput(!0),a0:n.a0,b0:n.b0,W:n.W,H:n.H})})}_shoreWorker(){return this._worker===void 0?(this._worker=this._newShoreWorker(),this._worker?(this._worker.onmessage=e=>{let{id:t,out:n,error:r}=e.data??{},i=this._shoreJobs.get(t);i&&(this._shoreJobs.delete(t),i.gen===this._shoreGen&&this.shoreTexture&&(r||!n||!this.applyShore(i.job,n))&&this.rebakeShore(i.rect,{expand:i.expand}),i.resolve())},this._worker.onerror=e=>{e.preventDefault?.(),this._worker?.terminate(),this._worker=null;let t=[...this._shoreJobs.values()];this._shoreJobs.clear();for(let e of t)e.gen===this._shoreGen&&this.shoreTexture&&this.rebakeShore(e.rect,{expand:e.expand}),e.resolve()},this._worker):null):this._worker}_newShoreWorker(){if(typeof Worker!=`function`)return null;try{return new Worker(new URL(new URL(`shoreWorker-CWjE-yRZ.js`,import.meta.url).href,``+import.meta.url),{type:`module`})}catch{return null}}rebuild(e=null){let{flowChanged:t,hasWater:n}=this.updateTiles();return!e||t||!this.shoreTexture||!this._shoreData?this.refresh():this.rebakeShore(e),n}_updateShoreWindow(e,t=!0){let n=this.shoreJob(e,{expand:t});n&&this.applyShore(n,Ma(this.shoreInput(),n.a0,n.b0,n.W,n.H))}shoreInput(e=!1){let t=this.tileMap,n=t=>e?t.slice():t,r=t.colliders.filter(e=>!e.dynamic);return{width:t.width,depth:t.depth,R:this.resolution,surf:n(this._surf),flow:n(this._flow),bed:n(this._bed),colliders:e?r.map(e=>({...e})):r,maxDistance:this.maxDistance,maxDepth:this.maxDepth,maxFlow:this.maxFlow}}shoreJob(e,{expand:t=!0}={}){let n=this.tileMap,r=this.resolution,i=n.width*r,a=n.depth*r,o=this.shoreReach,s=t?o:0,c=e=>Math.max(0,Math.min(i,e)),l=e=>Math.max(0,Math.min(a,e)),u=c((Math.floor(e.minI)-s)*r),d=c((Math.floor(e.maxI)+1+s)*r),f=l((Math.floor(e.minJ)-s)*r),p=l((Math.floor(e.maxJ)+1+s)*r);if(d<=u||p<=f)return;let m=c(u-o*r),h=c(d+o*r),g=l(f-o*r),_=l(p+o*r);return{a0:m,b0:g,W:h-m,H:_-g,oa0:u,oa1:d,ob0:f,ob1:p,TW:i,TH:a}}applyShore(e,t){let n=this._shoreData;if(!n||!this.shoreTexture||e.TW!==this.tileMap.width*this.resolution||n.length!==e.TW*e.TH*4)return!1;for(let r=e.ob0;r<e.ob1;r++){let i=((r-e.b0)*e.W+(e.oa0-e.a0))*4;n.set(t.subarray(i,i+(e.oa1-e.oa0)*4),(r*e.TW+e.oa0)*4)}return this.shoreTexture.needsUpdate=!0,this._colliderCount=this.tileMap.colliders.length,this._colliderSig=this._waterColliderSignature(),!0}update(e){this.tileMap.colliders.length!==this._colliderCount&&(this._colliderCount=this.tileMap.colliders.length,this._waterColliderSignature()!==this._colliderSig&&this.refresh())}_waterColliderSignature(){if(!this.tiles.length)return``;let e=[];for(let t of this.tileMap.colliders){if(t.dynamic)continue;let n=t.type===`circle`,r=n?t.x-t.r:t.minX,i=n?t.x+t.r:t.maxX,a=n?t.z-t.r:t.minZ,o=n?t.z+t.r:t.maxZ;if(!(i>r&&o>a))continue;let s=!1,c=Math.min(this.tileMap.width-1,Math.floor(i)),l=Math.min(this.tileMap.depth-1,Math.floor(o));for(let e=Math.max(0,Math.floor(a));e<=l&&!s;e++)for(let t=Math.max(0,Math.floor(r));t<=c&&!s;t++)s=this._surfAt(t,e)===this._surfAt(t,e);s&&e.push(`${Math.round(r*64)},${Math.round(i*64)},${Math.round(a*64)},${Math.round(o*64)},${t.type}`)}return e.join(`;`)}_surfAt(e,t){let n=this.tileMap;return e<0||t<0||e>=n.width||t>=n.depth?NaN:this._surf[t*n.width+e]}_buildGeometry(){let e=this.tileMap,t=[],n=[],r=[],i=[],a=0,s=(e,o,s,c,l)=>{for(let i=0;i<4;i++)t.push(e[i*3],e[i*3+1],e[i*3+2]),n.push(o,s,c),r.push(l);i.push(a,a+1,a+2,a,a+2,a+3),a+=4},c=[{dx:0,dz:-1,nx:0,nz:-1},{dx:1,dz:0,nx:1,nz:0},{dx:0,dz:1,nx:0,nz:1},{dx:-1,dz:0,nx:-1,nz:0}];for(let t of this.tiles){let{i:n,j:r}=t,i=this._surfAt(n,r);s([n,i,r,n,i,r+1,n+1,i,r+1,n+1,i,r],0,1,0,i);for(let a of c){let o=e.tileAt(n+a.dx,r+a.dz),c;if(!o)c=t.h;else if(o.water){let e=this._surfAt(n+a.dx,r+a.dz);if(!(e<i-.01))continue;c=Math.max(e,t.h)}else{if(o.h>=i-.01)continue;c=Math.max(o.h,t.h)}if(i-c<.01)continue;let l=a.nz,u=-a.nx,d=n+.5+a.nx*.5,f=r+.5+a.nz*.5,p=d-l*.5,m=f-u*.5,h=d+l*.5,g=f+u*.5;s([p,c,m,h,c,g,h,i,g,p,i,m],a.nx,0,a.nz,i)}}let l=new Ae;return l.setAttribute(`position`,new z(t,3)),l.setAttribute(`normal`,new z(n,3)),l.setAttribute(`aTop`,new z(r,1)),l.setIndex(a>65535?new rt(i,1):new o(i,1)),l.computeBoundingBox(),l.computeBoundingSphere(),l}_buildShoreTexture(){let e=this.tileMap,t=this.resolution,n=Math.max(1,e.width*t),r=Math.max(1,e.depth*t),i=this._bakeShore(0,0,n,r);this._shoreData=i;let a=new je(i,n,r,re,d);return this._setupShoreTexture(a)}_setupShoreTexture(e){return e.name=`Luminati:WaterShore`,e.magFilter=V,e.minFilter=V,e.wrapS=e.wrapT=q,e.colorSpace=``,e.generateMipmaps=!1,e.needsUpdate=!0,e}_bakeShore(e,t,n,r){return Ma(this.shoreInput(),e,t,n,r)}dispose(){this._disposed=!0,this._bake?.end(),this._worker?.terminate(),this._worker=null;for(let e of this._shoreJobs.values())e.resolve();this._shoreJobs.clear(),this.geometry.dispose(),this.material.dispose(),this.shoreTexture?.dispose(),this.shoreTexture=null,this.object.removeFromParent()}},Ba=`
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
  vUv = uv;
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  #include <fog_vertex>
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
}
`,Va=`
uniform float uTime;
uniform float uNight;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uWidth;
uniform float uLength;
uniform float uLipLength;
uniform float uSeed;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uFoam;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${Ia}
void main() {
  #include <logdepthbuf_fragment>
  float t = uTime;
  float colX = floor(vUv.x * uWidth * 16.0);
  float nCols = floor(uWidth * 16.0 + 0.5);
  float py = floor(vUv.y * 16.0);            // pixel row along the sheet (arc length)
  float fall = max(0.0, vUv.y - uLipLength);  // distance fallen past the lip
  float h1 = lmHash(vec2(colX, uSeed));
  float h2 = lmHash(vec2(floor(colX / 3.0), uSeed + 5.0));
  // water accelerates: streaks scroll faster further down
  float speed = (2.2 + h1 * 1.4) * (0.5 + 0.5 * clamp(fall / 1.0, 0.0, 1.0));
  float s1 = fract(py / 16.0 * (0.55 + 0.35 * h2) - t * speed * 0.5 + h1 * 7.0);
  float s2 = fract(py / 16.0 * 0.3 - t * speed * 0.33 + h2 * 3.0);
  vec3 albedo = mix(uC1, uC0, 0.2 + 0.6 * h2);
  albedo = mix(albedo, uC2, step(0.7, s2) * 0.85);
  albedo = mix(albedo, uC3, step(s1, 0.16));
  albedo = mix(albedo, uFoam, step(0.91, s1));
  // foam where the water bends over the lip and churning at the bottom
  // discrete animation slots are wrapped so hash inputs stay precise after hours of uptime
  float lipFoam = 1.0 - step(0.1 + 0.16 * lmHash(vec2(colX, mod(floor(t * 6.0), 4096.0))), abs(vUv.y - uLipLength));
  float bn = lmNoise(vec2(colX * 0.45, py * 0.4 - t * 5.0));
  float botFoam = step(uLength - vUv.y, 0.2 + 0.42 * bn);
  float foam = max(lipFoam * 0.85, botFoam);
  albedo = mix(albedo, uFoam, foam);
  // lighting (the normal leans up: falling water scatters sky light)
  float shadow = getShadowMask();
  vec3 nW = normalize((gl_FrontFacing ? vWorldNormal : -vWorldNormal) + vec3(0.0, 1.1, 0.0));
  float nightF = clamp(uNight, 0.0, 1.0);
  vec3 col = albedo * lmNeutral(lmIrradiance(nW, vWorldPos, shadow), 0.5 * (1.0 - nightF)) * 1.12;
  col = lmSaturate(mix(col, uFogColor, 0.06), mix(1.12, 1.0, nightF));
  // sparkling droplets (HDR, bloom) in the white water
  float sp = step(0.988, lmHash(vec2(colX, py) + mod(floor(t * 9.0), 4096.0) * vec2(3.1, 7.7)));
  col += sp * (uSunColor * 2.2 + vec3(0.1)) * shadow * (1.0 - 0.8 * clamp(uNight, 0.0, 1.0)) * step(0.5, foam + step(0.9, s1));
  // ragged, splashing side edges and a soft entry from the river surface
  float edgePx = min(colX, nCols - 1.0 - colX);
  float jag = lmHash(vec2(py + mod(floor(t * 10.0), 4096.0) * 3.0, colX + uSeed));
  if (edgePx < 1.0 && jag < 0.55) discard;
  if (edgePx < 2.0 && jag < 0.18) discard;
  float entry = smoothstep(0.0, 0.18, vUv.y);
  if (entry < lmBayer4(vec2(colX, py)) * 0.999) discard;
  gl_FragColor = vec4(col, mix(0.9, 1.0, foam));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`,Ha=`
uniform float uTime;
uniform float uNight;
uniform vec3 uFogColor;
uniform vec3 uFoam;
uniform vec3 uC0;
uniform vec2 uSize;
uniform float uSeed;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${Ia}
void main() {
  #include <logdepthbuf_fragment>
  float t = uTime;
  vec2 px = floor(vUv * uSize * 16.0);
  vec2 pc = (px + 0.5) / 16.0;
  // distance from the impact line (v = 0 edge, centred across u)
  float across = abs(pc.x - uSize.x * 0.5) / (uSize.x * 0.5);
  float d = pc.y + max(0.0, across - 0.55) * 1.4;
  float churn = lmNoise(pc * 3.2 + vec2(t * 0.7, -t * 2.1) + uSeed);
  float bub = lmNoise(pc * 6.5 - vec2(0.0, t * 1.4) + uSeed * 2.0);
  float ring = step(0.8, fract(d * 2.2 - t * 0.9 + churn * 0.4)) * step(0.45, bub);
  float core = step(d, 0.36 + churn * 0.45);
  float speck = step(0.8, bub) * step(d, 0.95);
  float foam = max(core, max(ring * step(d, 1.05), speck * 0.8));
  foam *= step(across, 1.0 - churn * 0.12);
  if (foam < 0.5) discard;
  vec3 albedo = mix(uC0, uFoam, 0.72 + 0.28 * step(0.6, churn));
  float shadow = getShadowMask();
  float nightF = clamp(uNight, 0.0, 1.0);
  vec3 col = albedo * lmNeutral(lmIrradiance(vec3(0.0, 1.0, 0.0), vWorldPos, shadow), 0.45 * (1.0 - nightF)) * 1.1;
  col = mix(col, uFogColor, 0.05);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`,Ua=0,Wa=Object.freeze({N:Object.freeze([0,-1]),S:Object.freeze([0,1]),E:Object.freeze([1,0]),W:Object.freeze([-1,0])});function Ga(e){return Le(Wa,e)??Wa.S}function Ka({x:e,z:t,width:n=2,top:r,bottom:i,facing:o=`S`,seed:s,pool:c=!0,lip:l=.3}={}){let d=Ga(o),f=d[0],m=d[1],h=m,g=-f,_=Math.max(.05,r-i),v=s??a(Math.round(e*16),Math.round(t*16),77)*1e3+ ++Ua,y=[];y.push([-l,r+.012]),y.push([-l*.35,r+.012]),y.push([0,r+.004]);for(let e=1;e<=14;e++){let t=e/14,n=_*t*t;y.push([.04+.26*Math.sqrt(n)+.05*t,r-n])}let b=[0];for(let e=1;e<y.length;e++)b.push(b[e-1]+Math.hypot(y[e][0]-y[e-1][0],y[e][1]-y[e-1][1]));let x=b[b.length-1],S=b[2],C=Math.max(2,Math.ceil(n*4)),T=[],E=[],D=[];for(let r=0;r<=C;r++){let i=r/C,a=(i-.5)*n;for(let n=0;n<y.length;n++){let[r,o]=y[n];T.push(e+h*a+f*r,o,t+g*a+m*r),E.push(i,b[n])}}let O=y.length;for(let e=0;e<C;e++)for(let t=0;t<O-1;t++){let n=e*O+t,r=(e+1)*O+t;D.push(n,n+1,r+1,n,r+1,r)}let k=new Ae;k.setAttribute(`position`,new z(T,3)),k.setAttribute(`uv`,new z(E,2)),k.setIndex(D),k.computeVertexNormals(),k.computeBoundingSphere();let A=e=>{let t=B.merge([Z.lights,Z.fog,e]);return t.uTime=Q.uTime,t.uNight=Q.uNight,t.uSunColor=Q.uSunColor,t.uFogColor=Q.uFogColor,t.uFogStart=Q.uFogStart,t},j=new Me({name:`Luminati:Waterfall`,uniforms:A({uWidth:{value:n},uLength:{value:x},uLipLength:{value:S},uSeed:{value:v%97},uC0:{value:Fa[4].clone()},uC1:{value:Fa[3].clone()},uC2:{value:Fa[2].clone()},uC3:{value:Fa[5].clone()},uFoam:{value:Fa[6].clone().multiplyScalar(1.08)}}),vertexShader:Ba,fragmentShader:Va,fog:!0,lights:!0,transparent:!0,depthWrite:!0,side:2}),M=new R(k,j);M.name=`WaterfallSheet`,M.renderOrder=w.WATER+1,M.receiveShadow=!0;let N=new u;N.name=`Waterfall`,N.add(M);let P=null,I=null,L=null,ee=y[y.length-1][0];if(c){let r=n+1.1,a=1.25;I=new Ee(r,a),I.rotateX(-Math.PI/2);let o=new ge().makeBasis(new p(h,0,g),new p(0,1,0),new p(-f,0,-m));I.applyMatrix4(o),I.translate(e+f*(ee-.2+a/2),i+.012,t+m*(ee-.2+a/2)),L=new Me({name:`Luminati:WaterfallPool`,uniforms:A({uFoam:{value:Fa[6].clone().multiplyScalar(1.05)},uC0:{value:Fa[5].clone()},uSize:{value:new F(r,a)},uSeed:{value:v%53}}),vertexShader:Ba,fragmentShader:Ha,fog:!0,lights:!0,transparent:!1,depthWrite:!0,side:2,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),P=new R(I,L),P.name=`WaterfallPool`,P.renderOrder=w.WATER+2,P.receiveShadow=!0,N.add(P)}let te=f!==0,ne=[{preset:`mist`,position:new p(e+f*(ee+.3),i+.25,t+m*(ee+.3)),spawnSize:te?[.4,.3,n]:[n,.3,.4],velocity:[f*.45,.35,m*.45],velocityVariance:te?[.35,.3,.45]:[.45,.3,.35],width:n}];return{object:N,sheet:M,pool:P,emitters:ne,update(e){},dispose(){k.dispose(),j.dispose(),I?.dispose(),L?.dispose(),N.removeFromParent()}}}var qa={pz:{o:[-1,-1,1],s:[1,0,0],t:[0,1,0],n:[0,0,1],sd:0,td:1},nz:{o:[1,-1,-1],s:[-1,0,0],t:[0,1,0],n:[0,0,-1],sd:0,td:1},px:{o:[1,-1,1],s:[0,0,-1],t:[0,1,0],n:[1,0,0],sd:2,td:1},nx:{o:[-1,-1,-1],s:[0,0,1],t:[0,1,0],n:[-1,0,0],sd:2,td:1},py:{o:[-1,1,1],s:[1,0,0],t:[0,0,-1],n:[0,1,0],sd:0,td:2},ny:{o:[-1,-1,-1],s:[1,0,0],t:[0,0,1],n:[0,-1,0],sd:0,td:2}},Ja=[`pz`,`nz`,`px`,`nx`,`py`,`ny`],Ya=Object.freeze({vertexColors:!0}),Xa=new p,Za=new p,Qa=new p,$a=new p,eo=new p,to=new Ne,no=new ot,ro=new p,io=new p,ao=new ge;function oo(e=null,t=null,n=null,r=new ge){return io.set(e?e[0]:0,e?e[1]:0,e?e[2]:0),t==null?to.identity():typeof t==`number`?to.setFromEuler(no.set(0,t,0)):t.isQuaternion?to.copy(t):to.setFromEuler(no.set(t[0],t[1],t[2],t[3]||`XYZ`)),n==null?ro.set(1,1,1):typeof n==`number`?ro.set(n,n,n):ro.set(n[0],n[1],n[2]),r.compose(io,to,ro)}var so=class{constructor(e,{ao:t=null}={}){this.textures=e,this.parts=new Map,this.matrix=new ge,this._stack=[],this.color=[1,1,1],this.sway=0,this.phase=0,this.ao=t,this.center=[0,0,0]}mat(e,t=null){return typeof e==`string`?this.textures.material(e,t?{vertexColors:!0,...t}:Ya):e}units(e){let t=e.userData.units;if(t)return t;let n=e.userData.texture;return n?this.textures.meta(n).units:[1,1]}push(e=null,t=null,n=null){return this._stack.push(this.matrix.clone()),this.matrix.multiply(oo(e,t,n,ao)),this}pushMatrix(e){return this._stack.push(this.matrix.clone()),this.matrix.multiply(e),this}pop(){return this.matrix.copy(this._stack.pop()),this}point(e,t,n){return new p(e,t,n).applyMatrix4(this.matrix)}tinted(e,t){let n=this.color;return this.color=e,t(),this.color=n,this}_part(e){let t=this.parts.get(e);return t||(t={material:e,pos:[],nrm:[],uv:[],col:[],sway:[],phase:[],ctr:[],idx:[]},this.parts.set(e,t)),t}_local(e){return!e||!e.at&&e.rot==null&&e.scale==null?this.matrix:new ge().multiplyMatrices(this.matrix,oo(e.at,e.rot,e.scale))}_vert(e,t,n,r,i,a,o,s,c,l,u,d){Xa.set(r,i,a).applyMatrix4(t),Za.set(o,s,c).applyMatrix3(n).normalize();let f=e.pos.length/3;e.pos.push(Xa.x,Xa.y,Xa.z),e.nrm.push(Za.x,Za.y,Za.z),e.uv.push(l,u);let p=d||this.color,m=this.ao?this.ao(Xa.x,Xa.y,Xa.z):1;e.col.push(p[0]*m,p[1]*m,p[2]*m);let h=typeof this.sway==`function`?this.sway(Xa.x,Xa.y,Xa.z):this.sway;return e.sway.push(h),e.phase.push(this.phase),e.material.userData.billboard&&(Qa.fromArray(this.center).applyMatrix4(t),e.ctr.push(Qa.x,Qa.y,Qa.z)),f}_grid(e,t,n,r,i,a,o,s,c,l={}){let u=this._part(e),d=(e,t)=>{let n=[0];if(e)for(let r of e)r>1e-4&&r<t-1e-4&&n.push(r);return n.push(t),n.sort((e,t)=>e-t)},f=d(l.cutsS,o),p=d(l.cutsT,s),m=l.uv===`fit`,h=l.scale||this.units(e),g=l.off||[0,0],_=l.rep||[1,1],v=u.pos.length/3;for(let e=0;e<p.length;e++)for(let d=0;d<f.length;d++){let v=f[d],y=p[e],b=r[0]+i[0]*v+a[0]*y,x=r[1]+i[1]*v+a[1]*y,S=r[2]+i[2]*v+a[2]*y,C,w;m?(C=v/o*_[0]+g[0],w=y/s*_[1]+g[1]):l.rotUV?(C=(y+g[0])/h[0],w=(v+g[1])/h[1]):(C=(v+g[0])/h[0],w=(y+g[1])/h[1]),l.flipU&&(C=-C),this._vert(u,t,n,b,x,S,c[0],c[1],c[2],C,w,l.color)}let y=f.length;for(let e=0;e<p.length-1;e++)for(let t=0;t<y-1;t++){let n=v+e*y+t;u.idx.push(n,n+1,n+y+1,n,n+y+1,n+y)}}box(e,t,n={}){let r=this._local(n),i=new W().getNormalMatrix(r),a=[t[0]/2,t[1]/2,t[2]/2];for(let o of Ja){let s=n.faces?n.faces[o]:void 0;if(s===!1)continue;s===void 0||s===!0?s={}:(typeof s==`string`||s.isMaterial)&&(s={mat:s});let c={uv:n.uv,off:n.off,rep:n.rep,rotUV:n.rotUV,color:n.color,scale:n.scale,...s},l=qa[o];c.cutsT===void 0&&l.td===1&&(c.cutsT=n.cutsT);let u=this.mat(c.mat||e),d=[l.o[0]*a[0],l.o[1]*a[1],l.o[2]*a[2]];this._grid(u,r,i,d,l.s,l.t,t[l.sd],t[l.td],l.n,c)}return this}poly(e,t,n){let r=this.mat(e),i=this._part(r),a=this._local(n),o=new W().getNormalMatrix(a),s=n.scale||this.units(r),c=n.origin||[0,0,0],l=n.off||[0,0],u=n.normal;u||=(Qa.fromArray(t[0]),$a.fromArray(t[1]).sub(Qa),eo.fromArray(t[2]).sub(Qa),$a.cross(eo).normalize(),[$a.x,$a.y,$a.z]);let d=i.pos.length/3;for(let e of t){let t=e[0]-c[0],r=e[1]-c[1],d=e[2]-c[2],f=(t*n.uAxis[0]+r*n.uAxis[1]+d*n.uAxis[2]+l[0])/s[0],p=(t*n.vAxis[0]+r*n.vAxis[1]+d*n.vAxis[2]+l[1])/s[1];this._vert(i,a,o,e[0],e[1],e[2],u[0],u[1],u[2],f,p,n.color)}for(let e=1;e<t.length-1;e++)i.idx.push(d,d+e,d+e+1);return this}quad(e,t,n,r={}){let i=this.mat(e),a=this._part(i),o=this._local(r),s=new W().getNormalMatrix(o),c=null;r.normals||(Qa.fromArray(t[0]),$a.fromArray(t[1]).sub(Qa),eo.fromArray(t[3]).sub(Qa),$a.cross(eo).normalize(),c=[$a.x,$a.y,$a.z]);let l=a.pos.length/3;for(let e=0;e<4;e++){let i=r.normals?r.normals[e]:c,l=r.colors?r.colors[e]:r.color;this._vert(a,o,s,t[e][0],t[e][1],t[e][2],i[0],i[1],i[2],n[e][0],n[e][1],l)}return a.idx.push(l,l+1,l+2,l,l+2,l+3),this}tri(e,t,n,r,i,a,o,s={}){let c=this.mat(e),l=this._part(c),u=this._local(s),d=new W().getNormalMatrix(u),f=s.normal;f||=(Qa.fromArray(t),$a.fromArray(n).sub(Qa),eo.fromArray(r).sub(Qa),$a.cross(eo).normalize(),[$a.x,$a.y,$a.z]);let p=l.pos.length/3;return this._vert(l,u,d,t[0],t[1],t[2],f[0],f[1],f[2],i[0],i[1],s.color),this._vert(l,u,d,n[0],n[1],n[2],f[0],f[1],f[2],a[0],a[1],s.color),this._vert(l,u,d,r[0],r[1],r[2],f[0],f[1],f[2],o[0],o[1],s.color),l.idx.push(p,p+1,p+2),this}lathe(e,t,n={}){let r=this.mat(e),i=n.segments||8,a=this._local(n),o=new W().getNormalMatrix(a),s=this.units(r),c=0;for(let e of t)c=Math.max(c,e.r);let l=n.uRepeat??Math.max(1,Math.round(Math.PI*2*c/s[0])),u=n.vScale??s[1],d=n.phase||0,f=n.smooth!==!1,p=[];for(let e=0;e<t.length;e++){let r=t[e],a=[];for(let t=0;t<=i;t++){let o=t%i,s=d+o/i*Math.PI*2,c=r.r*(n.radiusFn?n.radiusFn(e,o,s):1),l=r.y+(n.yFn?n.yFn(e,o,s):0);a.push([(r.cx||0)+Math.cos(s)*c,l,(r.cz||0)-Math.sin(s)*c])}p.push(a)}let m=[0];for(let e=1;e<t.length;e++){let n=t[e-1],r=t[e];m.push(m[e-1]+Math.hypot(r.r-n.r,r.y-n.y,(r.cx||0)-(n.cx||0),(r.cz||0)-(n.cz||0)))}let h=n.vOff||0,g=this._part(r),_=n.normalUp||0;if(f){let e=g.pos.length/3;for(let e=0;e<t.length;e++){let r=t[Math.max(0,e-1)],s=t[Math.min(t.length-1,e+1)],c=s.r-r.r,f=s.y-r.y,v=Math.hypot(c,f)||1,y=f/v,b=-c/v+_,x=Math.hypot(y,b)||1;y/=x,b/=x;for(let t=0;t<=i;t++){let r=d+t%i/i*Math.PI*2,s=p[e][t],c=n.colorFn?n.colorFn(e,t%i):n.color;this._vert(g,a,o,s[0],s[1],s[2],Math.cos(r)*y,b,-Math.sin(r)*y,t/i*l,(m[e]+h)/u,c)}}let r=i+1;for(let n=0;n<t.length-1;n++)for(let t=0;t<i;t++){let i=e+n*r+t;g.idx.push(i,i+1,i+r+1,i,i+r+1,i+r)}}else for(let e=0;e<t.length-1;e++)for(let t=0;t<i;t++){let r=p[e][t],s=p[e][t+1],c=p[e+1][t+1],d=p[e+1][t],f=t/i*l,v=(t+1)/i*l,y=(m[e]+h)/u,b=(m[e+1]+h)/u;Qa.fromArray(r),$a.fromArray(s).sub(Qa),eo.fromArray(d).sub(Qa),eo.lengthSq()<1e-10&&eo.fromArray(c).sub(Qa),$a.cross(eo).normalize(),_&&($a.y+=_,$a.normalize());let x=[$a.x,$a.y,$a.z],S=n.colorFn?n.colorFn(e,t):n.color,C=g.pos.length/3;this._vert(g,a,o,r[0],r[1],r[2],x[0],x[1],x[2],f,y,S),this._vert(g,a,o,s[0],s[1],s[2],x[0],x[1],x[2],v,y,S),this._vert(g,a,o,c[0],c[1],c[2],x[0],x[1],x[2],v,b,S),this._vert(g,a,o,d[0],d[1],d[2],x[0],x[1],x[2],f,b,S),g.idx.push(C,C+1,C+2,C,C+2,C+3)}let v=(e,r,s)=>{let c=this.mat(s),l=this.units(c),u=this._part(c),d=t[e],f=d.y,m=u.pos.length/3,h=r?1:-1;this._vert(u,a,o,d.cx||0,f,d.cz||0,0,h,0,(d.cx||0)/l[0],-(d.cz||0)/l[1],n.color);for(let t=0;t<i;t++){let r=p[e][t];this._vert(u,a,o,r[0],r[1],r[2],0,h,0,r[0]/l[0],-r[2]/l[1],n.color)}for(let e=0;e<i;e++){let t=m+1+e,n=m+1+(e+1)%i;r?u.idx.push(m,t,n):u.idx.push(m,n,t)}};return n.capTop&&v(t.length-1,!0,n.capTop===!0?r:n.capTop),n.capBottom&&v(0,!1,n.capBottom===!0?r:n.capBottom),this}tube(e,t,n,r,i,a={}){let o=new p(n[0]-t[0],n[1]-t[1],n[2]-t[2]),s=o.length();o.normalize();let c=new Ne().setFromUnitVectors(new p(0,1,0),o);a.twist&&c.multiply(new Ne().setFromAxisAngle(new p(0,1,0),a.twist));let l=a.rings||2,u=[];for(let e=0;e<l;e++){let t=e/(l-1);u.push({y:t*s,r:r+(i-r)*t})}return this.pushMatrix(new ge().compose(new p(t[0],t[1],t[2]),c,new p(1,1,1))),this.lathe(e,u,a),this.pop(),this}get vertexCount(){let e=0;for(let t of this.parts.values())e+=t.pos.length/3;return e}build(e=`prop`,{castShadow:t=!0,receiveShadow:n=!0}={}){let r=new u;r.name=e;let i=[],a=[];for(let o of this.parts.values()){if(!o.idx.length)continue;let s=new Ae;s.setAttribute(`position`,new z(o.pos,3)),s.setAttribute(`normal`,new z(o.nrm,3)),s.setAttribute(`uv`,new z(o.uv,2)),s.setAttribute(`color`,new z(o.col,3)),o.material.userData.wind&&(s.setAttribute(`aSway`,new z(o.sway,1)),s.setAttribute(`aPhase`,new z(o.phase,1))),o.material.userData.billboard&&s.setAttribute(`aCenter`,new z(o.ctr,3)),s.setIndex(o.idx),s.computeBoundingSphere(),s.computeBoundingBox();let c=(o.material.userData.billboard?1.5:0)+(o.material.userData.wind?.3:0);c&&(s.boundingSphere.radius+=c,s.boundingBox.expandByScalar(c));let l=new R(s,o.material);l.matrixAutoUpdate=!1;let u=o.material.userData;l.castShadow=u.castShadow??t,l.receiveShadow=u.receiveShadow??n,u.depthMaterial&&(l.customDepthMaterial=u.depthMaterial),l.name=`${e}:${u.texture||o.material.name||`mat`}`,r.add(l),i.push(l),a.push(s)}return this.parts.clear(),{group:r,meshes:i,geometries:a}}},co=`
uniform float uTime;
uniform vec2 uWind;
uniform float uWindStrength;
uniform float uCameraYaw;
uniform vec3 uSunDirection;
attribute float aSway;
attribute float aPhase;
#ifdef FOLIAGE_BILLBOARD
attribute vec3 aCenter;
#endif
`,lo=`
#include <begin_vertex>
{
  mat3 wM3 = mat3( modelMatrix );
  float wS2 = max( dot( wM3[ 0 ], wM3[ 0 ] ), 1e-6 );
#ifdef FOLIAGE_BILLBOARD
  {
    #ifdef FOLIAGE_SHADOW_PASS
      vec2 bbDir = normalize( uSunDirection.xz + vec2( 1e-4, 0.0 ) );
      float bbYaw = atan( bbDir.x, bbDir.y );
      float bbTilt = 0.15;
    #else
      float bbYaw = uCameraYaw;
      float bbTilt = 0.42;
    #endif
    vec3 bbOff = position - aCenter;
    vec3 bbToCam = vec3( sin( bbYaw ), 0.0, cos( bbYaw ) );
    vec3 bbRight = vec3( cos( bbYaw ), 0.0, - sin( bbYaw ) );
    vec3 bbUp = normalize( vec3( 0.0, 1.0, 0.0 ) - bbToCam * bbTilt );
    vec3 bbWorld = ( bbRight * bbOff.x + bbUp * bbOff.y + bbToCam * bbOff.z ) * sqrt( wS2 );
    transformed = aCenter + ( bbWorld * wM3 ) / wS2;
  }
#endif
  vec3 wOrigin = modelMatrix[ 3 ].xyz;
  float wLen = length( uWind );
  vec2 wDir = wLen > 1e-4 ? uWind / wLen : vec2( 1.0, 0.0 );
  float wPh = aPhase + wOrigin.x * 0.23 + wOrigin.z * 0.17;
  float wT = uTime;
  // slow gusts travelling across the map + two-frequency sway + small per-leaf flutter
  float gust = 0.55 + 0.45 * sin( wT * 0.43 - dot( wOrigin.xz, wDir ) * 0.09 );
  float sway = sin( wT * 1.21 + wPh ) * 0.62 + sin( wT * 2.37 + wPh * 1.73 ) * 0.38;
  float amp = aSway * uWindStrength * ( 0.35 + 0.65 * min( wLen, 2.0 ) );
  vec3 wDisp = vec3( 0.0 );
  wDisp.xz = wDir * ( sway * 0.075 + gust * 0.06 ) * amp;
  float flutter = sin( wT * 4.3 + dot( position, vec3( 2.9, 2.1, 1.7 ) ) + wPh * 2.0 ) * 0.022 * amp;
  wDisp.xz += vec2( -wDir.y, wDir.x ) * flutter;
  wDisp.y = flutter * 0.7 - sway * sway * 0.012 * amp;
  // world → object (uniform scale): M^-1 d = (d * M3) / s^2
  transformed += ( wDisp * wM3 ) / wS2;
}
`,uo=X.normal_fragment_begin.replace(`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;`,`float faceDirection = 1.0;`),fo=X.lights_lambert_pars_fragment.replace(`float dotNL = saturate( dot( geometryNormal, directLight.direction ) );`,`float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + FOLIAGE_WRAP ) / ( 1.0 + FOLIAGE_WRAP ) );`);function po(e,t){e.uniforms.uTime=Q.uTime,e.uniforms.uWind=Q.uWind,e.uniforms.uWindStrength=Q.uWindStrength,e.uniforms.uCameraYaw=Q.uCameraYaw,e.uniforms.uSunDirection=Q.uSunDirection,e.vertexShader=e.vertexShader.replace(`#include <common>`,`${t}#include <common>\n${co}`).replace(`#include <begin_vertex>`,lo)}function mo(e,{foliage:t=!1,wrap:n=.45,billboard:r=!1}={}){let i=r?`#define FOLIAGE_BILLBOARD
`:``;e.onBeforeCompile=e=>{po(e,i),t&&(e.fragmentShader=e.fragmentShader.replace(`#include <normal_fragment_begin>`,uo).replace(`#include <lights_lambert_pars_fragment>`,`#define FOLIAGE_WRAP ${n.toFixed(3)}\n${fo}`))};let a=`luminati-wind-${t?`foliage-${n.toFixed(3)}`:`solid`}${r?`-bb`:``}`;return e.customProgramCacheKey=()=>a,e.userData.wind=!0,r&&(e.userData.billboard=!0),e.userData.depthMaterial=ho({billboard:r}),e}function ho({billboard:e=!1}={}){let t=new ke,n=e?`#define FOLIAGE_BILLBOARD
#define FOLIAGE_SHADOW_PASS
`:``;return t.onBeforeCompile=e=>po(e,n),t.customProgramCacheKey=()=>`luminati-wind-depth${e?`-bb`:``}`,t}var go=[.55,.62,.75,.9,1,2.4];function _o(){return ve.fire.map((e,t)=>f(e).multiplyScalar(go[t]))}var vo=`
uniform float uCameraYaw;
uniform float uLift;
varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec3 wCenter = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  float sx = length( modelMatrix[ 0 ].xyz );
  float sy = length( modelMatrix[ 1 ].xyz );
  vec3 right = vec3( cos( uCameraYaw ), 0.0, - sin( uCameraYaw ) );
  vec3 toCam = vec3( sin( uCameraYaw ), 0.0, cos( uCameraYaw ) );
  vec3 wPos = wCenter + right * position.x * sx + vec3( 0.0, 1.0, 0.0 ) * position.y * sy + toCam * uLift;
  vec4 mvPosition = viewMatrix * vec4( wPos, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,yo=`
float fh21( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float fnoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fh21( i ), fh21( i + vec2( 1.0, 0.0 ) ), f.x ),
              mix( fh21( i + vec2( 0.0, 1.0 ) ), fh21( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
`,bo=`
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uSpeed;
uniform vec2 uPx;
uniform vec3 uFire[ 6 ];
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
${yo}
void main() {
  vec2 px = floor( vUv * uPx );
  vec2 uv = ( px + 0.5 ) / uPx;
  // stepped time → hand-animated feel (12 fps). Every noise input is kept small (time wrapped
  // every 50 s, seed folded to [0, 20)) — the fract()-hash loses float32 precision past ~10^3,
  // which would quantise the tongues after a long session or for large seeds.
  float sOff = fract( uSeed * 0.1731 ) * 20.0;
  float t = mod( floor( uTime * 12.0 * uSpeed ), 600.0 ) / 12.0 + sOff;
  float y = uv.y;
  float x = uv.x * 2.0 - 1.0;
  // tongues: horizontal displacement growing with height, scrolling upward
  float wob = fnoise( vec2( y * 3.2 - t * 2.3, t * 0.7 + sOff ) ) - 0.5;
  x += wob * 0.35 * y;
  // teardrop profile: broad rounded base, full belly, pointed tip
  float w = 0.98 * pow( max( 1.0 - y, 0.0 ), 0.42 ) * ( 0.9 + 0.1 * smoothstep( 0.0, 0.3, y ) );
  // rounded bottom (no flat rectangular cut at the base of the quad)
  float rb = 1.0 - clamp( y / 0.16, 0.0, 1.0 );
  w *= mix( 0.45, 1.0, sqrt( max( 1.0 - rb * rb, 0.0 ) ) );
  float heat = ( 1.0 - abs( x ) / max( w, 1e-3 ) ) * 1.3;
  // split the upper half into 2–3 licking lobes
  float lob = sin( x * 6.9 + t * 1.7 + sOff ) * 0.5 + 0.5;
  heat -= ( 1.0 - lob ) * 0.6 * smoothstep( 0.5, 1.0, y );
  // turbulence in pixel space (chunky), stronger toward the tip → broken tongues
  vec2 q = vec2( px.x * 0.42, px.y * 0.36 - t * 5.5 );
  float n = fnoise( q + sOff * 3.0 ) * 0.6 + fnoise( q * 2.1 + 3.7 ) * 0.4;
  heat += ( n - 0.5 ) * ( 0.3 + 0.5 * y );
  heat -= y * 0.15;
  if ( heat < 0.08 ) discard;
  // bands: small white-hot core low in the flame, yellow heart, orange body, red rim; the dark
  // red only on the lower rim so broken-off tongue pixels near the tip stay fiery orange-red
  vec3 col;
  if ( heat > 1.05 && y < 0.38 ) col = uFire[ 5 ];
  else if ( heat > 0.9 ) col = uFire[ 4 ];
  else if ( heat > 0.55 ) col = uFire[ 3 ];
  else if ( heat > 0.24 || y < 0.25 || y > 0.55 ) col = uFire[ 2 ];
  else col = uFire[ 1 ];
  gl_FragColor = vec4( col * uIntensity, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`,xo=`
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uNight;
uniform float uDay;
uniform float uBaseV;
uniform vec3 uColor;
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
${yo}
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  float g = pow( max( 1.0 - r, 0.0 ), 1.7 );
  // fade out toward / below the flame base: the vertical card would otherwise cut a hard
  // horizontal edge where it intersects the ground (campfire) or a wall
  g *= smoothstep( uBaseV - 0.04, uBaseV + 0.2, vUv.y );
  float flick = 0.82 + 0.18 * fnoise( vec2( mod( uTime, 60.0 ) * 7.0, fract( uSeed * 0.1731 ) * 40.0 ) );
  float k = g * flick * uIntensity * mix( uDay, 1.0, uNight );
  if ( k < 0.002 ) discard;
  gl_FragColor = vec4( uColor * k, 1.0 );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // additive: fade the contribution out with fog instead of tinting toward the fog colour
    #ifdef FOG_EXP2
      float fogF = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogF = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    gl_FragColor.rgb *= 1.0 - fogF;
  #endif
}
`;function So({width:e,height:t,seed:n=0,intensity:r=1,speed:i=1}){let a=B.merge([Z.fog,{uSeed:{value:n},uIntensity:{value:r},uSpeed:{value:i},uLift:{value:.02},uPx:{value:new F(Math.max(4,Math.round(e*16)),Math.max(4,Math.round(t*16)))},uFire:{value:_o()}}]);return a.uTime=Q.uTime,a.uCameraYaw=Q.uCameraYaw,a.uFogStart=Q.uFogStart,new Me({name:`luminati:flame`,uniforms:a,vertexShader:vo,fragmentShader:bo,fog:!0,side:2})}function Co({color:e=16747066,intensity:t=.6,seed:n=0,day:r=.25,baseV:i=-1}={}){let a=B.merge([Z.fog,{uSeed:{value:n},uIntensity:{value:t},uDay:{value:r},uLift:{value:-.05},uBaseV:{value:i},uColor:{value:new G(e)}}]);return a.uTime=Q.uTime,a.uCameraYaw=Q.uCameraYaw,a.uNight=Q.uNight,a.uFogStart=Q.uFogStart,new Me({name:`luminati:glow`,uniforms:a,vertexShader:vo,fragmentShader:xo,fog:!0,transparent:!0,depthWrite:!1,blending:2,side:2})}function wo({width:e=.5,height:t=.75,seed:n=0,intensity:r=1,speed:i=1,glow:a=!0,glowSize:o=2.6,glowIntensity:s=.55,glowColor:c=16747066}={}){let l=new u;l.name=`flame`;let d=new Ee(e,t);d.translate(0,t/2,0);let f=So({width:e,height:t,seed:n,intensity:r,speed:i}),p=new R(d,f);p.name=`flame:body`,p.castShadow=!1,p.receiveShadow=!1,l.add(p);let m=[f],h=[d],g=null;if(a){let r=Math.max(e,t)*o,i=new Ee(r,r);i.translate(0,t*.4,0);let a=Co({color:c,intensity:s,seed:n,baseV:.5-t*.4/r});g=new R(i,a),g.name=`flame:glow`,g.renderOrder=w.PARTICLES+5,g.castShadow=!1,g.receiveShadow=!1,l.add(g),m.push(a),h.push(i)}return{object:l,flame:p,glow:g,materials:m,geometries:h}}var To=ve.outline;function Eo(e,t,{alpha:n=!1,normalStrength:r=2,wrap:i=!0}={}){let a=e.width,o=e.height,s=Se(e.toCanvas(),{wrap:`repeat`,mipmaps:!0,anisotropy:4}),c=ie(a,o,(e,n)=>t[n*a+e],{strength:r,wrap:i});return{map:s,normal:Se(c.toCanvas(),{wrap:`repeat`,mipmaps:!0,srgb:!1,anisotropy:4}),units:[a/16,o/16],alpha:n}}function Do(e){let t=new m(e),n=new nt(16,32);n.wrap=!0;let r=new Float32Array(512).fill(.6),i=[`#9c9a9a`,`#c4c1bb`,`#dedad2`,`#eeebe3`,`#f8f6ef`];for(let t=0;t<32;t++)for(let o=0;o<16;o++){let s=a(o,t>>1,e)*.5+a(o>>1,t>>2,e+3)*.5,c=O(Math.floor(s*3.2+1),0,4);n.set(o,t,i[c]),r[t*16+o]=.55+s*.1}for(let e=0;e<16;e++){let e=t.int(0,31),i=t.int(0,15),a=t.int(2,6);for(let t=0;t<a;t++)n.set(i+t,e,t===0||t===a-1?`#56555f`:`#2b2a33`),n.set(i+t,e+1,`#fbfaf5`),r[(e%32+32)%32*16+(i+t)%16]=.3}for(let e=0;e<2;e++){let e=t.int(0,15),i=t.int(0,31);for(let[t,a]of[[0,0],[1,0],[-1,0],[0,1],[2,1],[-2,1],[1,1],[-1,1],[0,-1]])n.set(e+t,i+a,a===-1?`#3d3c47`:To),r[((i+a)%32+32)%32*16+((e+t)%16+16)%16]=.2}return Eo(n,r,{normalStrength:2.2})}function Oo(e){let t=new nt(64,16,`#1d1311`),n=new Float32Array(1024).fill(.1);return[{ramp:[`#3a0c14`,`#7a1a22`,`#b8302e`,`#e0584a`,`#f7a37e`],r:2.2,step:4},{ramp:[`#4a1d0c`,`#9c4414`,`#dd7a1f`,`#f5a93a`,`#ffe08a`],r:2.2,step:4},{ramp:[`#0f261c`,`#1f4a2a`,`#3c7a36`,`#68a845`,`#a8d466`],r:3.1,step:6},{ramp:[`#170c24`,`#34194a`,`#5a2d78`,`#8a4aa8`,`#c08ad6`],r:1.3,step:3}].forEach((r,i)=>{let o=new m(e+i*97),s=i*16,c=[];for(let e=-1;e*r.step<16+r.step;e++)for(let t=-1;t*r.step<16+r.step;t++)c.push([t*r.step+(e&1?r.step/2:0)+o.range(-.7,.7)+1.5,e*r.step+o.range(-.7,.7)+1.5]);c.sort((e,t)=>e[1]-t[1]);for(let[l,u]of c){let c=r.r*o.range(.9,1.1);for(let o=Math.floor(u-c-1);o<=Math.ceil(u+c+1);o++)for(let d=Math.floor(l-c-1);d<=Math.ceil(l+c+1);d++){if(d<0||o<0||d>=16||o>=16)continue;let f=d+.5-l,p=o+.5-u,m=Math.hypot(f,p)/(c+.35);if(m>1)continue;let h=O(.62-f*.12-p*.16-m*.35+(i===2?(a(d,o,e)-.5)*.3:0),0,.999),g=r.ramp[Math.floor(h*r.ramp.length)];m>.84&&(g=r.ramp[0]),t.set(s+d,o,g),n[o*64+s+d]=.4+(1-m*m)*.6}let d=Math.round(l-c*.45-.5),f=Math.round(u-c*.45-.5);if(i!==2&&d>=0&&f>=0&&d<16&&f<16&&t.set(s+d,f,r.ramp[4]),i===0&&o.chance(.5)){let e=Math.round(l-.5),n=Math.round(u-c+.2);e>=0&&n>=0&&e<16&&n<16&&t.set(s+e,n,`#4a2a18`)}}}),Eo(t,n,{normalStrength:2.5,wrap:!1})}function ko(e){let t=new m(e),n=new nt(16,48),r=new Float32Array(768).fill(0),i=ve.wood,o=[`#8f8170`,`#b8a88e`,`#d6c8aa`,`#ebe1c9`,`#f6efdd`];for(let t=0;t<39;t++)for(let i=1;i<15;i++){let s=Math.sin(i/14*Math.PI*2.2+.4)*.5+.5,c=a(i,t,e),l=O(Math.floor(1+s*2.2+c*.9-(t>34?.8:0)),0,4);n.set(i,t,o[l]),r[t*16+i]=.35+s*.15}let s=t.int(6,24),c=t.int(3,9);n.rect(c,s,3,3,`#c9a77a`),n.strokeRect(c,s,3,3,`#9a7a55`);let l=(e,t,i,a=.9)=>{n.set(e,t,i),e>=0&&t>=0&&e<16&&t<48&&(r[t*16+e]=a)};for(let e=0;e<48;e++)l(0,e,i[1]),l(15,e,i[2]),e>=39&&l(8,e,i[3]);for(let e=0;e<48;e+=5){for(let t=0;t<16;t++)l(t,e,t===0?i[1]:i[3],.85);for(let t=0;t<16;t++)e+1<48&&n.getAlpha(t,e+1)>0&&n.set(t,e+1,ae(n.get(t,e+1),-.25))}for(let e=0;e<16;e++)l(e,47,i[2]);return Eo(n,r,{alpha:!0,normalStrength:2,wrap:!1})}function Ao(e){let t=new m(e),n=new nt(32,32),r=new Float32Array(1024).fill(0),i=ve.leavesAutumn;for(let e=0;e<70;e++){let e=t.next()*Math.PI*2,a=Math.sqrt(t.next())*14,o=Math.round(16+Math.cos(e)*a),s=Math.round(16+Math.sin(e)*a*.9),c=i[t.int(1,4)],l=i[Math.min(5,t.int(3,5))];n.set(o,s,c),n.set(o+1,s,t.chance(.5)?c:l),t.chance(.6)&&n.set(o,s+1,ae(c,-.2)),t.chance(.3)&&n.set(o-1,s,l),r[O(s,0,31)*32+O(o,0,31)]=1}return Eo(n,r,{alpha:!0,normalStrength:1,wrap:!1})}function jo(e){let t=new nt(16,16),n=new Float32Array(256),r=[`#141116`,`#221c20`,`#352c2c`,`#4a3f3b`,`#6b5f58`];for(let i=0;i<16;i++)for(let o=0;o<16;o++){let s=a(o,i,e)*.6+a(o>>1,i>>1,e+1)*.4;t.set(o,i,r[O(Math.floor(s*5),0,4)]),n[i*16+o]=s,a(o,i,e+9)>.93&&t.set(o,i,it(`#ff7a2a`,`#5a1208`,a(i,o,e)))}return Eo(t,n,{normalStrength:1.5})}function Mo(e,t=!1){let n=new m(e),r=new nt(32,32);r.wrap=!0;let i=new Float32Array(1024),a=[`#3d4053`,`#4f5468`,`#626a7c`,`#767e8d`,`#8e97a3`],o=[`#1c2f25`,`#2e4a31`,`#4b6b3a`,`#6f8d45`,`#93ad55`];for(let t=0;t<32;t++)for(let n=0;n<32;n++){let o=ct(n/8,t/8,{octaves:3,seed:e,period:4}),s=(S(n,t)-.5)*.35,c=O((o-.5)*1.35+.55+s*.5,0,.999);r.set(n,t,a[Math.floor(c*a.length)]),i[t*32+n]=.45+o*.3}for(let e=0;e<3;e++){let e=n.int(0,31),t=n.int(0,31),a=n.int(4,8),o=n.chance(.5)?1:-1;for(let s=0;s<a;s++)r.set(e,t,`#2a2b3a`),r.set(e,t+1,`#9aa3ad`),i[(t%32+32)%32*32+(e%32+32)%32]=.15,e+=o,n.chance(.45)&&(t+=n.chance(.5)?1:-1),n.chance(.15)&&(o=-o)}for(let e=0;e<10;e++){let e=n.int(0,31),t=n.int(0,31);r.set(e,t,n.chance(.5)?`#a9a86a`:`#c8b77a`)}if(t){for(let t=0;t<32;t++)for(let n=0;n<32;n++){let a=ct(n/8+11.3,t/8+7.1,{octaves:3,seed:e+5,period:4});if(a<.4)continue;let s=O((a-.4)*3.6+(S(n,t)-.5)*.4,0,.999);r.set(n,t,o[Math.min(4,1+Math.floor(s*4))]),i[t*32+n]=.7+s*.25}let t=r.clone();for(let e=0;e<32;e++)for(let n=0;n<32;n++){let i=t.get(n,e);i[1]>i[2]+8||t.get(n,e-1)[1]>t.get(n,e-1)[2]+8&&r.set(n,e,`#2e3b30`)}}return Eo(r,i,{normalStrength:2.2})}var No={birch:Do,produce:Oo,sail:ko,leaf_litter:Ao,ash:jo,boulder:e=>Mo(e,!1),boulder_moss:e=>Mo(e,!0)},Po=class{constructor(e=42){this.seed=e>>>0,this._tex=new Map,this._mats=new Map}textures(e){let t=this._tex.get(e);return t||(t=No[e](this.seed+(e===`boulder_moss`?`boulder`:e).length*7919),this._tex.set(e,t)),t}material(e,t={}){let n=`${e}|${JSON.stringify(t)}`,r=this._mats.get(n);if(r)return r;let i=this.textures(e);return r=new Be({map:i.map,normalMap:i.normal,normalScale:new F(.6,.6),vertexColors:!0,...i.alpha?{alphaTest:.5,side:2}:{},...t}),r.name=`luminati:prop:${e}`,r.userData.units=i.units,r.userData.texture=null,i.alpha&&(r.userData.alpha=!0),this._mats.set(n,r),r}dispose(){for(let e of this._tex.values())e.map.dispose(),e.normal.dispose();for(let e of this._mats.values())e.dispose();this._tex.clear(),this._mats.clear()}};function Fo(e){if(!e?.isMesh||!e.castShadow||e.isInstancedMesh||e.customDepthMaterial)return!1;let t=e.material;return!(!t||Array.isArray(t)||t.isShaderMaterial||t.alphaTest>0&&(t.map||t.alphaMap)||t.displacementMap&&t.displacementScale!==0||t.alphaToCoverage||t.clipShadows)}function Io(e,t){return e.frustumCulled=!0,e.intersectsFrustum=function(e){return Lo(t,e)&&e.intersectsObject(this)},e}function Lo(e,t){for(let n=0;n<e.length;n++)if(e[n].shadow?.getFrustum?.()===t)return!0;return!1}var Ro=new xe;function zo(e,t){return ki(Bo(e,t))}function*Bo(e,{lights:t,maxTriangles:r=64e3,maxExtent:i=48,name:a=`shadowCasters`}){let o=new u;o.name=a;let s=[],c=[],l=new Map,d=new Map,f=!1;for(let t of e){let e=t.geometry;if(!e?.attributes?.position||!Ii(e))continue;let n=t.side??0,r=`${n}|${+!!e.index}`,i=d.get(r);i||d.set(r,i=[]),e.boundingSphere||e.computeBoundingSphere(),Ro.copy(e.boundingSphere);let a=t.tag??null;a!==null&&(f=!0),i.push({g:e,side:n,tag:a,x:Ro.center.x,z:Ro.center.z,tris:Ii(e)})}for(let e of d.values()){let u=Ai(e,{x:e=>e.x,z:e=>e.z,weight:e=>e.tris,maxWeight:r,maxExtent:i});f&&(u=u.map(e=>Ni(e,e=>e.tag)));for(let e of u){let r=Di(e.map(({g:e})=>{let t=new Ae;return t.setAttribute(`position`,e.getAttribute(`position`)),e.index&&t.setIndex(e.index),t}),!1);if(!r)continue;r.computeBoundingSphere();let i=e[0].side,u=l.get(i);u||(u=new n({side:i,colorWrite:!1,depthWrite:!1}),u.name=`${a}:proxy`,l.set(i,u)),f&&c.push(...Pi(r,e.map(e=>e.g.attributes.position.count),e.map(e=>e.tag),[`position`]));let d=new R(r,u);d.name=`${a}#${s.length}`,d.castShadow=!0,d.receiveShadow=!1,d.matrixAutoUpdate=!1,Li(d,{only:e=>Lo(t,e)}),o.add(d),s.push(d),yield}}return{object:o,meshes:s,ranges:c,dispose(){for(let e of s)e.geometry.dispose();for(let e of l.values())e.dispose();o.removeFromParent()}}}var Vo={0:1,1:0,2:2},Ho=new p(0,-1e3,0);function Uo(e,{lights:t}){let n=new Map;e.traverse(e=>{if(!(e.isMesh||e.isPoints||e.isLine)||!e.castShadow||!e.geometry||e.isSkinnedMesh||e.isBatchedMesh)return;let t=e.geometry,r=e.customDepthMaterial,i=[].concat(e.material);if(!i.some(e=>e&&e.visible))return;let a=e.isInstancedMesh?`I${e.instanceColor?`c`:``}${e.morphTexture?`m`:``}`:e.isPoints?`P`:e.isLine?`L${e.isLineSegments?`s`:e.isLineLoop?`l`:``}`:`M`;a+=`|${Object.keys(t.attributes).sort().join(`,`)}|${Object.keys(t.morphAttributes).sort().join(`,`)}`;for(let e of i){if(!e||!e.visible){a+=`|-`;continue}let t=!!(e.displacementMap&&e.displacementScale!==0||e.alphaMap&&e.alphaTest>0||e.map&&e.alphaTest>0||e.alphaToCoverage||e.clipShadows);a+=r||t?`|${r?r.uuid:``}:${e.uuid}`:`|${e.shadowSide??Vo[e.side]}:${+!!e.wireframe}`}let o=t.index?t.index.count:t.attributes.position?.count??0,s=t.instanceCount,c=e.isInstancedMesh?o:o*Math.max(1,Number.isFinite(s)?s:1),l=n.get(a);(!l||c<l.size)&&n.set(a,{o:e,size:c})});let r=new u;r.name=`shadowPrimer`,r.position.copy(Ho);let i=[],a=e=>Lo(t,e);for(let{o:e}of n.values()){let t;if(e.isInstancedMesh){let n=new I(e.geometry,e.material,1);e.instanceColor&&n.setColorAt(0,new G(1,1,1)),e.morphTexture&&(n.morphTexture=e.morphTexture),t=n}else t=e.isPoints?new Ge(e.geometry,e.material):e.isLineSegments?new b(e.geometry,e.material):e.isLineLoop?new ue(e.geometry,e.material):e.isLine?new te(e.geometry,e.material):new R(e.geometry,e.material);t.name=`shadowPrimer:${e.name}`,e.customDepthMaterial&&(t.customDepthMaterial=e.customDepthMaterial),e.customDistanceMaterial&&(t.customDistanceMaterial=e.customDistanceMaterial),t.castShadow=!0,t.receiveShadow=!1,t.frustumCulled=!0,t.intersectsFrustum=a,r.add(t),i.push(t)}return{object:r,count:i.length,dispose(){r.removeFromParent();for(let e of i){let t=e;t.isInstancedMesh&&(t.morphTexture=null,t.dispose())}i.length=0}}}var $=`wood_planks_dark`;function Wo(e,t){let n=e/2/t;return Math.abs(n-Math.round(n))<=Math.abs(n-.5-Math.round(n-.5))+1e-6?-e/2:-e/2+t/2}function Go(e,t,n,r={}){return{pz:{off:[Wo(e,n),r.vOff||0],...r},nz:{off:[Wo(e,n),r.vOff||0],...r},px:{off:[Wo(t,n),r.vOff||0],...r},nx:{off:[Wo(t,n),r.vOff||0],...r}}}function Ko(e,t,n,r,i,{w:a=.24,h:o=.32,metal:s=`metal`}={}){e.box(t,[a,o,a],{at:[n,r,i],faces:{py:!1,ny:!1},uv:`fit`});let c=a/2+.012;for(let t of[-1,1])for(let a of[-1,1])e.box(s,[.045,o+.03,.045],{at:[n+t*c,r,i+a*c]});let l=a+.08;e.box(s,[l,.05,l],{at:[n,r-o/2-.02,i]}),e.box(s,[l*.55,.05,l*.55],{at:[n,r-o/2-.065,i]});let u=r+o/2,d=l/2+.02,f=u+.17,p=[n,f,i],m=[[n-d,u,i+d],[n+d,u,i+d],[n+d,u,i-d],[n-d,u,i-d]];for(let t=0;t<4;t++){let n=m[t],r=m[(t+1)%4];e.tri(s,n,r,p,[0,0],[.5,0],[.25,.3])}e.box(s,[l,.04,l],{at:[n,u+.01,i]}),e.box(s,[.06,.1,.06],{at:[n,f+.03,i]}),e.box(s,[.1,.03,.1],{at:[n,f+.09,i]})}function qo(e,t,n,r,i=1,a=.28,o=0){let s=t-i/2,c=t+i/2,l=7/16,u=`flowerbox`;e.quad(u,[[s,n,r],[c,n,r],[c,n+1,r],[s,n+1,r]],[[o,0],[o+i,0],[o+i,1],[o,1]]);let d=r-a;e.quad(u,[[c,n,d],[s,n,d],[s,n+1,d],[c,n+1,d]],[[o+.43,0],[o+.43+i,0],[o+.43+i,1],[o+.43,1]]);let f=r-a*.5;e.quad(u,[[s,n+l-.05,f],[c,n+l-.05,f],[c,n+1,f],[s,n+1,f]],[[o+.21,.3875],[o+.21+i,.3875],[o+.21+i,1],[o+.21,1]]),e.quad(u,[[c,n,r],[c,n,d],[c,n+l,d],[c,n+l,r]],[[0,0],[a,0],[a,l],[0,l]]),e.quad(u,[[s,n,d],[s,n,r],[s,n+l,r],[s,n+l,d]],[[0,0],[a,0],[a,l],[0,l]]),e.box($,[i-.02,.04,a-.02],{at:[t,n+l-.06,r-a/2],faces:{ny:!1},color:[.42,.34,.3]}),e.box($,[i,.03,a],{at:[t,n+.015,r-a/2],faces:{py:!1}})}var Jo={front:{n:[0,1],yaw:0},back:{n:[0,-1],yaw:Math.PI},right:{n:[1,0],yaw:Math.PI/2},left:{n:[-1,0],yaw:-Math.PI/2}},Yo={front:`right`,back:`left`,left:`front`,right:`back`},Xo=[[.62,.78,1],[.7,.95,.65],[1,.72,.62],[1,1,1]];function Zo(e,t,n,r,i={}){let a={width:4,depth:3,stories:1,roof:`roof_red`,wall:`timber_frame`,rotation:0,chimney:!0,door:`front`,...i},o=e.textures,s=e.rng(`house`,t,r,a.seed),c=!!a.gableFront,l=c?a.depth:a.width,u=c?a.width:a.depth,d=O(Math.round(a.stories),1,2),f=a.plinthHeight??.5,p=a.storyHeight??3,m=d>1?a.upperHeight??2:0,h=d>1?a.jetty??.25:0,g=a.wall,_=a.upperWall??g,v=a.plinth??`stone_brick`,y=f+p+m,b=l/2,x=u/2,S=x+h,C=(a.pitch??s.range(38,45))*M,w=a.overhang??.35,T=S*Math.tan(C),E=a.roofThickness??.22,D=.1,k=e.builder((e,t)=>{let n=.62+.38*de(-.05,1.1,t);return t>f&&t<y+.01&&(n*=1-.2*de(y-.9,y,t)),n});c&&k.matrix.makeRotationY(-Math.PI/2);let A=e.windowMaterial(),j=e.glassMaterial(),N=[],P=[],F=[{material:A,day:0,night:1.6}],I={},L=o.meta(v).units[0];k.box(v,[l+2*D,f,u+2*D],{at:[0,f/2,0],faces:{...Go(l+2*D,u+2*D,L),ny:!1},cutsT:[f*.5]});let R=o.meta(g).units[0];k.box(g,[l,p,u],{at:[0,f+p/2,0],faces:{...Go(l,u,R),py:!1,ny:!1},cutsT:[.5,p-.9]}),Qo(k,o,g,l,u,f,p,s,{top:d===1,bottom:!0});let ee=f+p;if(d>1){let e=o.meta(_).units[0];k.box(_,[l,m,u+2*h],{at:[0,ee+m/2,0],faces:{...Go(l,u+2*h,e),py:!1,ny:!1},cutsT:[m-.9]}),k.box($,[l+.14,.24,u+2*h+.14],{at:[0,ee+.04,0]});let t=Math.max(2,Math.round(l/.55));for(let e=0;e<t;e++){let n=-b+.25+e*(l-.5)/(t-1);for(let e of[-1,1])k.box($,[.13,.13,h+.08],{at:[n,ee-.13,e*(x+h/2)],faces:{nz:!(e>0),pz:!(e<0)}})}Qo(k,o,_,l,u+2*h,ee+.16,m-.16,s,{top:!0,bottom:!1})}let te=a.gable??(_===`brick`||_===`stone_brick`?`wood_planks`:_),ne=d>1?ee:f,re=o.meta(te).units,ie=te===`wood_planks`||te===`wood_planks_dark`,z=Wo(2*S,re[0]);for(let e of[1,-1]){let t=e*b,n=e>0?[[t,y,S],[t,y,-S],[t,y+T+.02,0]]:[[t,y,-S],[t,y,S],[t,y+T+.02,0]],r=e>0?[0,0,-1]:[0,0,1];k.poly(te,n,ie?{uAxis:[0,1,0],vAxis:r,origin:[t,ne,e*S],off:[0,z]}:{uAxis:r,vAxis:[0,1,0],origin:[t,ne,e*S],off:[z,0]}),k.box($,[.1,.16,2*S+.1],{at:[t+e*.05,y+.02,0]}),ie||k.box($,[.1,T*.8,.16],{at:[t+e*.04,y+T*.4,0],rotUV:!0})}let B=a.roof,ae=o.meta(B).units[0],oe=Math.cos(C),se=Math.sin(C),V=Math.tan(C),ce=l+2*w,le=(S+w)/oe+E*V,ue=((S+w)/oe-E*V)/2,H=y+T;for(let e of[1,-1]){let t=[0,H-se*ue+oe*E/2,e*(oe*ue+se*E/2)];k.push(t,e>0?[C,0,0]:[C,Math.PI,0,`YXZ`]),k.box(B,[ce,E,le],{faces:{py:{off:[Wo(ce,ae),0]},ny:{mat:$,color:[.8,.78,.8]},pz:{mat:$},nz:!1,px:{mat:$},nx:{mat:$}}}),k.box($,[ce+.1,E+.16,.09],{at:[0,-.06,le/2+.03],faces:{nz:!1}});for(let e of[-1,1])k.box($,[.09,E+.16,le+.02],{at:[e*(ce/2+.035),-.06,.005],faces:{nz:!1}});k.pop()}let fe=H+E/oe;if(k.box(a.ridge??B,[ce+.14,.3,.3],{at:[0,fe-.05,0],rot:[Math.PI/4,0,0],faces:{px:$,nx:$},color:[.82,.8,.82]}),a.chimney){let e=(a.chimneySide??(s.chance(.5)?1:-1))*Math.max(.2,b-.8),t=s.chance(.6)?-S*.42:S*.3,n=fe+.75,r=y-.2,i=.74,c=o.meta(`chimney_stone`).units;k.box(`chimney_stone`,[i,n-r,i],{at:[e,(n+r)/2,t],faces:{...Go(i,i,c[0],{vOff:r-y}),ny:!1,py:!1}}),k.box(v,[.94,.16,.94],{at:[e,n+.08,t]}),k.box(`chimney_stone`,[.64,.12,.64],{at:[e,n+.2,t],faces:{py:!1}}),k.box(`chimney_stone`,[.48,.02,.48],{at:[e,n+.255,t],faces:{ny:!1},color:[.1,.08,.08]}),I.smoke=k.point(e,n+.45,t)}let U=(e,t)=>{let n=Jo[e],r=e===`front`||e===`back`,i=t?x+h:x;return{L:r?l:t?u+2*h:u,cx:n.n[0]*b,cz:n.n[1]*i,yaw:n.yaw,long:r}},pe=e=>k.push([e.cx,0,e.cz],e.yaw),W=a.door===`none`||a.door===!1?null:a.door||`front`,me=W?c?Le(Yo,W):W:null,he=a.shutters??s.chance(.6),ge=Xo[s.int(0,Xo.length-1)],_e=a.flowerboxes??!0,ve=0;for(let e of[`front`,`back`,`right`,`left`]){let t=U(e,!1);pe(t);let n=e===me;if(n){let e=t.L/2-1.15,n=t.L>=4&&(t.L<5.5||s.chance(.5));ve=a.doorOffset??(n?s.chance(.5)?-e:e:0),es(k,o,ve,f,D,v,s,a),I.door=k.point(ve,0,1),I.leafA=k.point(ve-.5,f+1,.02),I.leafB=k.point(ve+.5,f+1,.02);let r=t.L/2-(ve+.7)>=ve-.7+t.L/2?1:-1,i=ve+r*.98;if((a.lantern??!0)&&Math.abs(i)<t.L/2-.15){let e=f+1.95;k.box(`metal`,[.05,.05,.46],{at:[i,e+.36,.23]}),k.box(`metal`,[.04,.04,.32],{at:[i,e+.25,.12],rot:[-.75,0,0]}),k.box(`metal`,[.1,.14,.03],{at:[i,e+.3,.015]}),Ko(k,j,i,e,.44,{w:.22,h:.28}),F.push({material:j,day:0,night:2.4}),I.lantern=k.point(i,e,.6)}if(a.sign){let e=ve-r*1;Math.abs(e)<t.L/2+.2&&(k.push([e,0,0],-r*Math.PI/4),ns(k,o,0,f+2.35),k.pop())}}let r=f+1,i=$o(t.L,n?ve:null,t.long);for(let a of i){if(!n&&!t.long&&s.chance(.25))continue;let i=_e&&(e===`front`||s.chance(.3))&&s.chance(.75),o=Math.min(t.L/2-Math.abs(a),n?Math.abs(a-ve)-.75:9);ts(k,A,a,r,{shutters:he&&o>1.12,shutterTint:ge,flowerbox:i,uShift:s.range(0,1)})}if(k.pop(),d>1){let t=U(e,!0);pe(t);let n=$o(t.L,null,t.long);for(let r of n){if(!t.long&&s.chance(.3))continue;let n=t.L/2-Math.abs(r);ts(k,A,r,ee+.5,{shutters:he&&n>1.12,shutterTint:ge,flowerbox:_e&&e===`front`&&s.chance(.5),uShift:s.range(0,1)})}k.pop()}}if(a.woodpile??s.chance(.55)){let e=U(s.chance(.5)?`right`:`left`,!1);pe(e),rs(k,s.range(-.4,.4)*(e.L-2),.38),k.pop()}let ye=e.finish(k,`house`,t,n,r,a.rotation),be=t=>e.world(ye,t);I.lantern&&N.push({position:be(I.lantern),color:16757867,intensity:6,distance:7,flicker:.25,nightOnly:!0}),a.windowLights&&I.door&&N.push({position:be(I.door).setY(n+1.6),color:16754266,intensity:3,distance:6,flicker:.1,nightOnly:!0}),I.smoke&&P.push({preset:`smoke`,position:be(I.smoke),rate:3});let G=e.result(ye,{colliders:c?e.boxColliders(ye,-x-D,x+D,-b-D,b+D):e.boxColliders(ye,-b-D,b+D,-x-D,x+D),lights:N,emissives:F,emitters:P});return I.door&&(G.interact={position:be(I.door),radius:1.1,id:a.id??`house`,lookSpan:{a:be(I.leafA),b:be(I.leafB)}}),G}function Qo(e,t,n,r,i,a,o,s,{top:c=!0,bottom:l=!0}={}){let u=r/2,d=i/2;if(n===`timber_frame`||n===`plaster`){for(let t of[-1,1])for(let n of[-1,1])e.box($,[.2,o,.2],{at:[t*(u-.06),a+o/2,n*(d-.06)],rotUV:!0,faces:{py:!1,ny:!1}});l&&e.box($,[r+.08,.16,i+.08],{at:[0,a+.08,0],faces:{ny:!1}})}else if(n===`brick`){let t=Math.floor(o/.5);for(let n=0;n<t;n++){let t=n%2==0;for(let r of[-1,1])for(let i of[-1,1]){let o=t?.62:.34,c=t?.34:.62;e.box(`stone_brick`,[o,.46,c],{at:[r*(u-o/2+.04),a+n*.5+.25,i*(d-c/2+.04)],faces:{ny:!1},off:[s.range(0,1),0]})}}l&&e.box(`stone_brick`,[r+.1,.18,i+.1],{at:[0,a+.09,0],faces:{ny:!1}})}else if(n===`log_wall`){let t=Math.round(o/.5);for(let n=0;n<t;n++){let t=a+n*.5+.25,r=n%2==0;for(let n of[-1,1])for(let i of[-1,1]){let a=n*(u-.05),o=i*(d-.05);r?e.tube(`bark`,[a-n*.12,t,o],[a+n*.32,t,o],.2,.19,{segments:6,capTop:`wood_planks`,twist:.3}):e.tube(`bark`,[a,t,o-i*.12],[a,t,o+i*.32],.2,.19,{segments:6,capTop:`wood_planks`,twist:.3})}}}c&&e.box($,[r+.12,.2,i+.12],{at:[0,a+o-.1,0],faces:{py:!1}})}function $o(e,t,n){let r=-e/2+.85,i=e/2-.85,a=[];t==null?a.push([r,i]):(t-1.38>=r&&a.push([r,t-1.38]),t+1.38<=i&&a.push([t+1.38,i]));let o=[];for(let[e,t]of a){let r=t-e;if(r<0)continue;let i=Math.floor(r/(n?1.9:2.4))+1;if(n||(i=Math.min(i,1)),i===1)o.push((e+t)/2);else for(let t=0;t<i;t++)o.push(e+t*r/(i-1))}return o}function es(e,t,n,r,i,a,o,s){e.quad(`door`,[[n-.5,r,.02],[n+.5,r,.02],[n+.5,r+2,.02],[n-.5,r+2,.02]],[[0,0],[1,0],[1,1],[0,1]]);for(let t of[-1,1])e.box($,[.15,2.16,.18],{at:[n+t*.575,r+1.08,.07],rotUV:!0});if(e.box($,[1.46,.2,.22],{at:[n,r+2.1,.09]}),e.box($,[1.2,.05,.16],{at:[n,r+.02,.08],faces:{ny:!1}}),e.box(a,[1.5,.25,.5],{at:[n,.125,i+.25],faces:{ny:!1},off:[.3,0]}),s.doorHood??o.chance(.55)){let t=r+2.45;e.box(s.roof,[1.8,.1,.78],{at:[n,t,.36],rot:[.32,0,0],faces:{ny:$,px:$,nx:$,pz:$}});for(let r of[-1,1])e.box($,[.08,.08,.62],{at:[n+r*.7,t-.26,.26],rot:[-.7,0,0]})}}function ts(e,t,n,r,{shutters:i,shutterTint:a,flowerbox:o,uShift:s=0}){e.quad(t,[[n-.5,r,.02],[n+.5,r,.02],[n+.5,r+1,.02],[n-.5,r+1,.02]],[[0,0],[1,0],[1,1],[0,1]]),e.box($,[1.16,.08,.1],{at:[n,r+1,.05]});for(let t of[-1,1])e.box($,[.08,1.02,.1],{at:[n+t*.54,r+.5,.05],rotUV:!0});if(e.box($,[1.36,.09,.24],{at:[n,r-.045,.11]}),e.box($,[1.3,.13,.15],{at:[n,r+1.1,.07]}),i)for(let t of[-1,1])e.box(`wood_planks`,[.46,1.04,.05],{at:[n+t*.83,r+.5,.035],rotUV:!0,color:a}),e.box($,[.4,.06,.02],{at:[n+t*.83,r+.8,.07]}),e.box($,[.4,.06,.02],{at:[n+t*.83,r+.2,.07]});o&&qo(e,n,r-.09-7/16,.36,1.1,.26,s)}function ns(e,t,n,r){e.box(`metal`,[.05,.05,1.05],{at:[n,r,.52]}),e.box(`metal`,[.04,.04,.6],{at:[n,r-.2,.25],rot:[.62,0,0]});for(let t of[.3,.9])e.box(`metal`,[.02,.14,.02],{at:[n,r-.08,t]});let i=.52;e.box(`sign_board`,[.06,i,.95],{at:[n,r-.15-i/2,.6],faces:{px:{off:[1.05/2,.48/2]},nx:{off:[1.05/2,.48/2]},py:$,ny:$,pz:$,nz:$}})}function rs(e,t,n){for(let[r,i]of[[4,0],[3,.5],[2,1]])for(let a=0;a<r;a++){let o=t+(a-(r-1)/2)*.36,s=.17+i*.62;e.tube($,[o,s,n+.3],[o,s,n-.25],.17,.17,{segments:6,capTop:`wood_planks`,capBottom:`wood_planks`,twist:a*.7+i,uRepeat:1})}e.box($,[1.6,.08,.7],{at:[t,.04,n+.02]})}var is=Math.PI*(3-Math.sqrt(5)),as={oak:{leaves:`leaves`,tint:[1,1,1],clusters:[9,12],crown:.44,flat:.8,trunk:.075,card:2},autumn:{leaves:`leaves_autumn`,tint:[1,1,1],clusters:[9,11],crown:.43,flat:.78,trunk:.072,card:2},birch:{leaves:`leaves`,tint:[1.1,1.15,.72],clusters:[6,8],crown:.3,flat:1.25,trunk:.036,card:2}};function os(e,t,n,r,i={}){let a=i.kind??`oak`,o=e.rng(`tree:${a}`,t,r,i.seed),s=(i.height??4.5)*o.range(.94,1.06),c=i.rotation??o.range(0,Math.PI*2),u,d;return a===`pine`?{group:d,trunkR:u}=ls(e,o,s,t,n,r,c):{group:d,trunkR:u}=cs(e,o,l(as,a)?a:`oak`,s,t,n,r,c,i),e.result(d,{colliders:[{type:`circle`,x:t,z:r,r:u+.12}]})}function ss(e,t){return(n,r,i)=>{let a=O((r-t)/Math.max(.1,e-t),0,1),o=Math.min(1,Math.hypot(n,i)/(e*.45));return a**1.35*(.75+.35*o)}}function cs(e,t,n,r,i,a,o,s,c){let l=as[n],u=n===`birch`,d=e.builder(),f=u?e.windMaterial(`birch`):e.windMaterial(`bark`),p=e.foliageMaterial(l.leaves,{billboard:!0}),m=r*l.crown,h=u?[m*.78,m*1.05,m*.78]:[m,m*l.flat,m],g=[t.range(-.12,.12),r-h[1]*.78-(u?.35:.2),t.range(-.12,.12)],_=g[1]-h[1]*(u?.1:.25),v=Math.max(.12,r*l.trunk);d.sway=ss(r,r*.28);let b=t.range(-.25,.25)*(u?1.5:1),x=t.range(-.25,.25)*(u?1.5:1),S=Array.from({length:7},()=>t.range(-.06,.38)),C=u?[{y:-.1,r:v*1.45},{y:.14,r:v*1.12},{y:_*.35,r:v,cx:b*.2,cz:x*.2},{y:_*.7,r:v*.82,cx:b*.6,cz:x*.6},{y:_+.4,r:v*.55,cx:b+g[0],cz:x+g[2]}]:[{y:-.12,r:v*1.75},{y:.12,r:v*1.28},{y:.45,r:v*1.04},{y:_*.55,r:v*.86,cx:b*.4,cz:x*.4},{y:_,r:v*.66,cx:b+g[0]*.5,cz:x+g[2]*.5},{y:_+.5,r:v*.4,cx:b*.8+g[0],cz:x*.8+g[2]}];d.lathe(f,C,{segments:7,phase:t.range(0,Math.PI),radiusFn:(e,t)=>e===0?1+S[t]:e===1?1+S[t]*.45:1,colorFn:e=>{let t=e===0?.6:e===1?.8:1;return[t,t,t]},vOff:t.range(0,2)});let[w,T]=l.clusters,E=t.int(w,T),D=[],k=t.range(0,1);for(let e=0;e<E;e++){let n=1-(e+k)/E*1.8,r=Math.sqrt(Math.max(0,1-n*n)),i=e*is+t.range(-.3,.3),a=t.range(.48,.72);D.push({p:[g[0]+Math.cos(i)*r*h[0]*a,g[1]+n*h[1]*a,g[2]+Math.sin(i)*r*h[2]*a],inner:!1})}D.push({p:[g[0]+t.range(-.2,.2),g[1]+h[1]*.55,g[2]+t.range(-.2,.2)],inner:!1});let A=u?2:4;for(let e=0;e<A;e++){let n=e/A*Math.PI*2+t.range(-.4,.4);D.push({p:[g[0]+Math.cos(n)*h[0]*.3,g[1]+t.range(-.25,.15)*h[1],g[2]+Math.sin(n)*h[2]*.3],inner:!0})}let j=t.int(2,3),M=D.filter(e=>!e.inner).sort((e,t)=>e.p[1]-t.p[1]);for(let e=0;e<j&&e<M.length;e++){let n=M[e*2%M.length].p,r=_*t.range(.72,.95),i=[r/_*b,r,r/_*x],a=[y(g[0],n[0],.8),y(r,n[1],.7),y(g[2],n[2],.8)];d.tube(f,i,a,v*.46,v*.16,{segments:5,rings:3,uRepeat:1})}let N=l.tint,P=[];for(let e of D){if(P.push({p:e.p,inner:e.inner,shade:1}),e.inner)continue;let n=t.range(0,Math.PI*2),r=t.range(.4,.6);P.push({p:[e.p[0]+Math.cos(n)*r,e.p[1]-t.range(.2,.38),e.p[2]+Math.sin(n)*r],inner:!1,shade:.9})}for(let e=0;e<P.length;e++){let n=P[e],r=l.card*t.range(.94,1.08),i=r/2,a=t.range(-.07,.07),o=t.range(-.05,.05),s=n.p,c=(s[0]-g[0])/h[0],u=(s[1]-g[1])/h[1],f=(s[2]-g[2])/h[2],m=Math.hypot(c,u,f),_=n.inner?.5:n.shade*O(.66+.5*m,.6,1.05)*(.8+.2*de(-.8,.6,u)),v=[N[0]*(1+a+o)*_,N[1]*(1+a)*_,N[2]*(1+a-o)*_];d.phase=t.range(0,6.283),d.center=s;let y=t.range(-.22,.22),b=Math.cos(y),x=Math.sin(y),S=[[-i,-i],[i,-i],[i,i],[-i,i]],C=[],w=[],T=[];for(let[e,t]of S){let n=e*b-t*x,i=e*x+t*b;C.push([s[0]+n,s[1]+i,s[2]]);let a=c+n/r*.5,o=u+i/r*.6+.45,l=f+.25,d=Math.hypot(a,o,l)||1;w.push([a/d,o/d,l/d]);let p=t<0?.8:1.06;T.push([v[0]*p,v[1]*p,v[2]*p])}d.quad(p,C,[[0,0],[1,0],[1,1],[0,1]],{normals:w,colors:T})}if(d.center=[0,0,0],n===`autumn`&&c.fallenLeaves!==!1){let n=e.decalMaterial(`leaf_litter`);d.sway=0;for(let e=0;e<2;e++){let r=t.range(0,Math.PI*2),i=g[0]+Math.cos(r)*t.range(.4,1.1),a=g[2]+Math.sin(r)*t.range(.4,1.1),o=t.range(0,Math.PI),s=[Math.cos(o),-Math.sin(o)],c=[Math.sin(o),Math.cos(o)],l=.025+e*.004,u=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([e,t])=>[i+s[0]*e+c[0]*t,l,a+s[1]*e+c[1]*t]);d.quad(n,u,[[0,0],[1,0],[1,1],[0,1]],{normals:[[0,1,0],[0,1,0],[0,1,0],[0,1,0]]})}}return{group:e.finish(d,`tree:${n}`,i,a,o,s),trunkR:v*1.1}}function ls(e,t,n,r,i,a,o){let s=e.builder(),c=e.windMaterial(`bark`),l=e.foliageMaterial(`pine`);s.sway=ss(n,n*.25);let u=Math.max(.14,n*.042);s.lathe(c,[{y:-.1,r:u*1.5},{y:.15,r:u*1.1},{y:n*.55,r:u*.7},{y:n*.8,r:u*.3}],{segments:6,colorFn:e=>e===0?[.6,.6,.6]:[.9,.9,.9]});let d=O(Math.round(n/.95),4,7),f=n*.34,p=n*.19,m=[],h=[];for(let e=0;e<d;e++){let n=e/(d-1);m.push(f*(1-.78*n)*t.range(.95,1.05)),h.push(m[e]*1.12+.3)}let g=n-p-h[d-1];for(let e=0;e<d;e++){let n=e/(d-1),r=m[e],i=h[e],a=p+g*n,o=.2+.14*(1-n),c=Array.from({length:12},(e,n)=>+(n%2==0)+t.range(-.25,.25)),u=y(.74,1,n),f=t.range(-.05,.05),_=t.range(-.05,.05);s.phase=t.range(0,6.283),s.lathe(l,[{y:a,r,cx:f,cz:_},{y:a+i*.3,r:r*.66,cx:f,cz:_},{y:a+i,r:.03,cx:f*.5,cz:_*.5}],{segments:12,phase:t.range(0,1),uRepeat:Math.max(3,Math.round(Math.PI*2*r/2)),vOff:t.range(0,.5),normalUp:.9,radiusFn:(e,t)=>e===0?1+.1*c[t]:e===1?1+.05*c[(t+1)%12]:1,yFn:(e,t)=>e===0?-o*(.35+.65*c[t]):0,colorFn:e=>{let t=u*(e===0?.52:e===1?1:1.12);return[t,t,t]}})}return{group:e.finish(s,`tree:pine`,r,i,a,o),trunkR:u*1.2}}function us(e,t,n,r,i={}){let a=i.rotation??0,o=i.height??2.9,s=i.style??`arm`,c=e.builder((e,t)=>.7+.3*de(0,.6,t)),l=e.glassMaterial(),u=`metal`;c.box(`stone_brick`,[.5,.26,.5],{at:[0,.13,0],faces:{ny:!1},off:[.2,0]}),c.box(`stone_brick`,[.38,.12,.38],{at:[0,.32,0],faces:{ny:!1},off:[.6,.1]}),c.box(u,[.2,.3,.2],{at:[0,.53,0]}),c.box(u,[.13,o-.6,.13],{at:[0,.68+(o-.6)/2-.1,0],faces:{ny:!1}}),c.box(u,[.2,.06,.2],{at:[0,1.25,0]}),c.box(u,[.2,.08,.2],{at:[0,o-.04,0]}),c.box(u,[.08,.14,.08],{at:[0,o+.07,0]}),c.box(u,[.14,.05,.14],{at:[0,o+.16,0]});let d;if(s===`top`)Ko(c,l,0,o+.45,0,{w:.3,h:.4}),d=[0,o+.45,0];else{let e=o-.1,t=.62;c.box(u,[t,.06,.06],{at:[t/2,e,0]}),c.box(u,[.08,.08,.08],{at:[t,e+.02,0]});let n=.17,r=.24,i=e-.2;for(let e=0;e<9;e++){let t=Math.PI*.5+e/9*Math.PI*1.75,a=Math.PI*.5+(e+1)/9*Math.PI*1.75,o=n*(1-e/9*.55),s=n*(1-(e+1)/9*.55),l=[r+Math.cos(t)*o,i+Math.sin(t)*o],d=[r+Math.cos(a)*s,i+Math.sin(a)*s],f=Math.hypot(d[0]-l[0],d[1]-l[1]);c.box(u,[f+.03,.04,.045],{at:[(l[0]+d[0])/2,(l[1]+d[1])/2,0],rot:[0,0,Math.atan2(d[1]-l[1],d[0]-l[0])]})}c.box(u,[.04,.24,.04],{at:[.08,e-.12,0],rot:[0,0,-.6]}),c.box(u,[.025,.14,.025],{at:[t,e-.09,0]});let a=e-.46;Ko(c,l,t,a,0,{w:.26,h:.34}),d=[t,a,0]}let f=e.finish(c,`lamppost`,t,n,r,a),m=e.world(f,new p(...d));return e.result(f,{colliders:[{type:`circle`,x:t,z:r,r:.26}],lights:[{position:m,color:16757867,intensity:i.intensity??12,distance:i.distance??9,flicker:.2,nightOnly:!0}],emissives:[{material:l,day:0,night:2.4}],emitters:[]})}function ds(e,t,n,r,i={}){let a=e.rng(`walltorch`,t,r,i.seed),o=i.rotation??0,s=e.builder(),c=`metal`;s.box(c,[.2,.34,.04],{at:[0,0,.02]}),s.box(c,[.05,.05,.3],{at:[0,-.06,.16]}),s.box(c,[.14,.05,.14],{at:[0,-.02,.3]});let l=[0,-.22,.26],u=[0,.3,.26+Math.sin(.28)*.5];s.tube(`bark`,l,u,.05,.065,{segments:6}),s.tube($,[0,u[1]-.12,u[2]-.035],[0,u[1]+.02,u[2]+.005],.085,.08,{segments:6,capTop:!0,color:[.35,.3,.3]});let d=e.finish(s,`wallTorch`,t,n,r,o),f=e.flame({width:.56,height:.8,seed:a.range(0,100),glowSize:2.4,glowIntensity:.5});f.object.position.set(0,u[1]+.01,u[2]),d.add(f.object),d.updateMatrixWorld(!0);let m=e.world(d,new p(0,u[1]+.35,u[2]+.2));return e.result(d,{colliders:[],lights:[{position:m,color:16751173,intensity:i.intensity??7,distance:i.distance??7,flicker:.45,nightOnly:!1}],emissives:[],emitters:i.embers?[{preset:`embers`,position:e.world(d,new p(0,u[1]+.5,u[2])),rate:2}]:[],flames:[f]})}function fs(e,t,n,r,i={}){let a=e.rng(`campfire`,t,r,i.seed),o=i.rotation??a.range(0,Math.PI*2),s=e.builder(),c=e.extra.material(`ash`);s.lathe(c,[{y:.012,r:.72},{y:.05,r:.5},{y:.06,r:.01}],{segments:10,smooth:!0,normalUp:2});let l=i.stones??10;for(let t=0;t<l;t++){let n=t/l*Math.PI*2+a.range(-.1,.1),r=.8+a.range(-.04,.04),i=a.range(.17,.23);e.rockGeom(s,Math.cos(n)*r,0,Math.sin(n)*r,[i*1.2,i*.8,i],a,{top:e.extra.material(`boulder`),side:e.extra.material(`boulder`),detail:0,yaw:-n})}let u=i.logs??4;for(let e=0;e<u;e++){let t=e/u*Math.PI*2+.4,n=Math.cos(t),r=Math.sin(t),i=[n*.62,.08,r*.62],a=[-n*.1,.36,-r*.1];s.tube(`bark`,i,a,.085,.06,{segments:6,capBottom:`wood_planks`,twist:e,colorFn:e=>e===0?[.95,.9,.9]:[.28,.22,.22],rings:2})}if(i.seat!==!1){let e=a.range(0,Math.PI*2),t=Math.cos(e)*1.7,n=Math.sin(e)*1.7,r=-Math.sin(e)*.7,i=Math.cos(e)*.7;s.tube(`bark`,[t-r,.2,n-i],[t+r,.21,n+i],.21,.2,{segments:7,capTop:`wood_planks`,capBottom:`wood_planks`,twist:.5})}let d=e.finish(s,`campfire`,t,n,r,o),f=e.flame({width:1.15,height:1.3,seed:a.range(0,100),glowSize:2.7,glowIntensity:.55});return f.object.position.set(0,.05,0),d.add(f.object),d.updateMatrixWorld(!0),e.result(d,{colliders:[{type:`circle`,x:t,z:r,r:.95}],lights:[{position:new p(t,n+.9,r),color:16747578,intensity:i.intensity??14,distance:i.distance??10,flicker:.5,nightOnly:!1}],emissives:[],emitters:[{preset:`embers`,position:new p(t,n+.7,r),rate:6},{preset:`smoke`,position:new p(t,n+1.5,r),rate:2.5}],interact:{position:new p(t,n,r),radius:1.6,id:i.id??`campfire`},flames:[f]})}var ps=Math.PI*2,ms=(e=.7,t=.62)=>(n,r)=>t+(1-t)*de(-.05,e,r);function hs(e,t,n,r,i={}){let a=e.rng(`well`,t,r,i.seed),o=i.rotation??0,s=i.roof??`wood_planks`,c=e.builder(ms(.8)),l=.82,u=Math.PI/8;c.lathe(`well_stone`,[{y:-.05,r:.86},{y:l,r:.82}],{segments:8,smooth:!1,phase:u,uRepeat:3,vOff:.18}),c.lathe(`well_stone`,[{y:l,r:.6199999999999999},{y:.2,r:.6}],{segments:8,smooth:!1,phase:u,uRepeat:2,color:[.45,.45,.5]});for(let e=0;e<8;e++){let t=(u+e/8*Math.PI*2+(u+(e+1)/8*Math.PI*2))/2,n=.73,r=1.7599999999999998*Math.sin(Math.PI/8);c.box(`stone_brick`,[r+.02,.14,.34],{at:[Math.cos(t)*n,.8799999999999999+a.range(-.015,.015),-Math.sin(t)*n],rot:t+Math.PI/2,off:[a.range(0,2),.2]})}let d=e.textures.material(`riverbed`,{vertexColors:!0,color:6982840});c.lathe(d,[{y:.38,r:.61},{y:.38,r:.01}],{segments:8,phase:u,smooth:!0,normalUp:5,color:[.35,.45,.6]});for(let e of[-1,1])c.box($,[.16,2.35,.16],{at:[e*.7699999999999999,1.225,0],rotUV:!0});c.box($,[1.94,.14,.14],{at:[0,2.3000000000000003,0]}),c.tube(`wood_planks`,[-.72,1.55,0],[.72,1.55,0],.09,.09,{segments:6,capTop:$,capBottom:$}),c.tube(`rope`,[-.25,1.55,0],[.25,1.55,0],.13,.13,{segments:6,uRepeat:2}),c.box(`metal`,[.04,.3,.04],{at:[.84,1.45,0]}),c.box(`metal`,[.04,.04,.22],{at:[.84,1.32,.11]}),c.box(`rope`,[.04,.55,.04],{at:[.05,1.2,.08]});let f=.05;c.lathe(`barrel`,[{y:.75,r:.14},{y:.97,r:.18}],{segments:8,uRepeat:1,vScale:.25,capBottom:`wood_planks`,smooth:!0,at:[f,0,.08]}),c.box(`metal`,[.36,.03,.03],{at:[f,1.0899999999999999,.08]});let m=2.44,h=.75,g=.62,_=.1,v=h/Math.cos(g)+.1,y=2.4,b=e.textures.meta(s).units[0];for(let e of[1,-1]){let t=v/2-.05,n=[0,y-Math.sin(g)*t+Math.cos(g)*_/2+h*Math.tan(g)*.35,Math.cos(g)*t*e];c.push(n,e>0?[g,0,0]:[g,Math.PI,0,`YXZ`]),c.box(s,[m,_,v],{faces:{py:{off:[Wo(m,b),0]},ny:$,px:$,nx:$,pz:$,nz:!1}}),c.box($,[2.5,.18,.06],{at:[0,-.03,v/2+.02],faces:{nz:!1}}),c.pop()}let x=y+h*Math.tan(g)*.35+_/Math.cos(g);c.box($,[2.54,.14,.14],{at:[0,x,0],rot:[Math.PI/4,0,0]});for(let e of[-1,1])c.box($,[.08,.5,.08],{at:[e*.7699999999999999,2.45,.2],rot:[-.7,0,0]}),c.box($,[.08,.5,.08],{at:[e*.7699999999999999,2.45,-.2],rot:[.7,0,0]});let S=e.finish(c,`well`,t,n,r,o);return e.result(S,{colliders:[{type:`circle`,x:t,z:r,r:.94}],interact:{position:new p(t,n,r),radius:1.72,id:i.id??`well`}})}function gs(e,t,n,r,i={}){let a=e.rng(`stall`,t,r,i.seed),o=i.cloth??`cloth_stripe`,s=i.rotation??0,c=i.width??3,l=i.depth??1.6,u=c/2,d=l/2,f=e.builder(ms(.6)),m=2.7,h=2.15;for(let e of[-1,1])f.box($,[.14,m,.14],{at:[e*(u-.07),m/2,-d+.07],rotUV:!0}),f.box($,[.14,h,.14],{at:[e*(u-.07),h/2,d-.07],rotUV:!0}),f.box($,[.1,.1,l],{at:[e*(u-.07),4.85/2-.15,0],rot:[Math.atan2(.5500000000000003,l),0,0]});let g=-d-.1,_=d+.45,v=Math.atan2(.6900000000000004,_-g),y=Math.hypot(_-g,.6900000000000004),b=e.textures.meta(o).units[0];f.push([0,4.75/2,(g+_)/2],[v,0,0]),f.box(o,[c+.3,.05,y],{faces:{py:{off:[Wo(c+.3,b),0]},ny:{color:[.62,.58,.6]},nz:!1}}),f.pop();let x=_+.01,S=Math.max(4,Math.round((c+.3)/.38)),C=(c+.3)/S,w=-(c+.3)/2,T=b;for(let e=0;e<S;e++){let t=w+e*C,n=t+C,r=2.01,i=1.8099999999999998,a=e=>(e-w)/T;f.quad(o,[[t,i,x],[n,i,x],[n,r,x],[t,r,x]],[[a(t),.8],[a(n),.8],[a(n),.9],[a(t),.9]],{color:[.95,.92,.92]}),f.tri(o,[t,i,x],[(t+n)/2,1.6699999999999997,x],[n,i,x],[a(t),.8],[a((t+n)/2),.73],[a(n),.8],{color:[.95,.92,.92]})}let E=d-.42;f.box(`wood_planks`,[c-.25,.8899999999999999,.62],{at:[0,.8899999999999999/2,E],faces:{ny:!1}}),f.box($,[c-.1,.08,.74],{at:[0,.9299999999999999,E]}),f.box(`cloth_red`,[c-.3,.5,.03],{at:[0,.6099999999999999,E+.33],faces:{ny:!1,nz:!1}});let D=Math.max(2,Math.floor((c-.4)/.72)),O=(c-.5)/D,k=e.extra.material(`produce`);for(let e=0;e<D;e++){let t=-((c-.5)/2)+O*(e+.5),n=(e+a.int(0,3))%4;_s(f,k,t,.97,E-.02,Math.min(.6,O-.08),.46,n,a)}if(i.display!==!1)for(let e of[-1,1]){let t=e*c*.27,n=d+.22;for(let e of[-.24,.24])f.box($,[.07,.36,.07],{at:[t+e,.18,n],rotUV:!0});f.push([t,.36,n],[.42,0,0]),_s(f,k,0,0,0,.62,.44,+(e>0)+a.int(0,1)*2,a,.2),f.pop()}f.box($,[c-.3,.07,.4],{at:[0,1.35,-d+.3]});for(let e=0;e<2;e++)_s(f,k,-u*.45+e*u*.9,1.39,-d+.3,.5,.34,(e+2+a.int(0,1))%4,a);let A=a.chance(.5)?1:-1,j=i.crates===`left`?-1:i.crates===`right`?1:i.crates===`none`?0:A;if(j){let t=e.textures.material(`crate`,{vertexColors:!0});f.box(t,[.7,.7,.7],{at:[j*(u+.5),.35,d-.3],rot:a.range(-.2,.2),uv:`fit`,faces:{ny:!1}}),_s(f,k,j*(u+.5),0,-d+.45,.62,.5,a.int(0,3),a,.55)}let M=e.finish(f,`marketStall`,t,n,r,s),N=[e.boxCollider(M,-u-.05,u+.05,-d-.05,d+(i.display===!1?.05:.5))];if(j){let t=j>0?u+.12:-u-.88;N.push(e.boxCollider(M,t,t+.76,-d+.18,d+.08))}return e.result(M,{colliders:N,interact:{position:e.world(M,new p(0,0,d+1.2)),radius:1.3,id:i.id??`stall`}})}function _s(e,t,n,r,i,a,o,s,c,l=.26){e.box(`crate`,[a,l,o],{at:[n,r+l/2,i],rot:c.range(-.08,.08),uv:`fit`,rep:[1,l/.9],faces:{ny:!1,py:!1}});let u=s*.25,d=a/2-.03,f=o/2-.03,p=r+l+.02,m=p+.1,h=(e,t)=>[u+O((e+d)/1,0,.999)*.25,O((t+f)/1,0,1)],g=[[-d,p,f],[d,p,f],[d,p,-f],[-d,p,-f]],_=[[-d*.45,m,0],[d*.45,m,0]];e.push([n,0,i]),e.quad(t,[g[0],g[1],_[1],_[0]],[h(-d,0),h(d,0),h(d*.45,f),h(-d*.45,f)]),e.quad(t,[g[2],g[3],_[0],_[1]],[h(d,2*f),h(-d,2*f),h(-d*.45,f),h(d*.45,f)]),e.tri(t,g[1],g[2],_[1],h(d,0),h(d,2*f),h(d*.45,f)),e.tri(t,g[3],g[0],_[0],h(-d,2*f),h(-d,0),h(-d*.45,f)),e.pop()}function vs(e,t,n,r,i,a,o={}){let s=e.rng(`bridge`,(t+r)/2,(n+i)/2,o.seed),c=o.width??2,l=r-t,u=i-n,d=Math.hypot(l,u),f=Math.atan2(l,u),p=o.arch??Math.min(.4,d*.05),m=o.postDepth??1.4,h=c/2,g=e.builder(),_=e=>p*Math.sin(Math.PI*O(e,0,1)),v=e=>-d/2+e*d,y=Math.max(2,Math.round(d/.5)),b=d/y;for(let e=0;e<y;e++){let t=e/y,n=(e+1)/y,r=(t+n)/2,i=Math.atan2(_(n)-_(t),b),a=c+s.range(-.06,.1);g.box(`wood_deck`,[a,.11,b-.035],{at:[s.range(-.04,.04),_(r)-.055+s.range(-.012,.012),v(r)],rot:[-i,s.range(-.03,.03),0],faces:{py:{off:[s.range(0,4),e%8*.5]},ny:{color:[.6,.6,.6]}},rotUV:!1})}let x=Math.max(2,Math.round(d/1));for(let e of[-1,1])for(let t=0;t<x;t++){let n=t/x,r=(t+1)/x,i=Math.hypot(d/x,_(r)-_(n)),a=Math.atan2(_(r)-_(n),d/x);g.box($,[.18,.2,i+.02],{at:[e*(h-.3),(_(n)+_(r))/2-.2,v((n+r)/2)],rot:[-a,0,0]})}let S=Math.max(2,Math.round(d/1.6)+1),C=[.5,.95];for(let e=0;e<S;e++){let t=e/(S-1),n=e===0||e===S-1,r=_(t)+(n?1.15:1.02),i=n?-.35:-m;for(let e of[-1,1]){let a=n?.2:.15;g.box($,[a,r-i,a],{at:[e*(h+.02),(r+i)/2,v(t)],rotUV:!0,color:[1,1,1]}),n&&g.box($,[a+.08,.08,a+.08],{at:[e*(h+.02),r+.04,v(t)]})}}if(o.rails!==!1)for(let e=0;e<S-1;e++){let t=e/(S-1),n=(e+1)/(S-1),r=Math.hypot(d/(S-1),_(n)-_(t)),i=Math.atan2(_(n)-_(t),d/(S-1));for(let e of[-1,1])for(let a of C)g.box(`wood_planks`,[.08,a>.8?.12:.09,r],{at:[e*(h+.02),(_(t)+_(n))/2+a+s.range(-.015,.015),v((t+n)/2)],rot:[-i,0,0]})}let w=(t+r)/2,T=(n+i)/2,E=e.finish(g,`bridge`,w,a,T,f),D=[],k=[],A=p>.02?Math.max(2,Math.round(d/.5)):1;for(let t=0;t<A;t++){let n=t/A,r=(t+1)/A,i=t===0?-.25:0,o=t===A-1?.25:0;for(let t of e.localRects(E,-h+.1,h-.1,v(n)+i,v(r)+o,.5))D.push({...t,y:a+_((n+r)/2)})}let j=Math.max(1,Math.round(d/1));for(let t=0;t<j;t++){let n=v(t/j),r=v((t+1)/j);for(let t of[-1,1])k.push(...e.boxColliders(E,t*(h+.02)-.12,t*(h+.02)+.12,n,r))}let M=e.result(E,{colliders:k});return M.walkRects=D,M}function ys(e,t,n,r,i={}){let a=e.rng(`windmill`,t,r,i.seed),o=i.rotation??0,s=i.height??6,c=i.roof??`roof_thatch`,l=i.wall??`plaster`,u=e.builder(ms(1)),d=Math.PI/8,f=1.12,p=e=>y(1.65,f,e/s);u.lathe(`stone_brick`,[{y:-.05,r:1.73},{y:.5,r:p(.5)+.06}],{segments:8,smooth:!1,phase:d,vOff:0}),u.lathe(`stone_brick`,[{y:.5,r:p(.5)},{y:2,r:p(2)}],{segments:8,smooth:!1,phase:d,vOff:.5}),u.lathe(l,[{y:2,r:p(2)},{y:3,r:p(3)},{y:s,r:f}],{segments:8,smooth:!1,phase:d,vOff:0,color:l===`plaster`?[.84,.8,.78]:void 0});let m=(e,t,n)=>u.lathe($,[{y:e-t/2,r:p(e)+n},{y:e+t/2,r:p(e)+n}],{segments:8,smooth:!1,phase:d,capTop:$,uRepeat:4});m(2,.2,.06),m(s-.05,.22,.08);for(let e=0;e<8;e++){let t=d+e/8*Math.PI*2,n=[Math.cos(t)*(p(2)+.02),2,-Math.sin(t)*(p(2)+.02)],r=[Math.cos(t)*1.1400000000000001,s,-Math.sin(t)*1.1400000000000001];u.tube($,n,r,.07,.06,{segments:4,uRepeat:1})}let h=1.5;u.lathe(c,[{y:s-.1,r:h},{y:s+.7,r:h*.62},{y:s+1.7,r:.05}],{segments:8,smooth:!0,phase:d,normalUp:.3,colorFn:e=>e===0?[.85,.85,.85]:[1,1,1]}),u.lathe($,[{y:s-.22,r:1.52},{y:s-.08,r:1.52}],{segments:8,smooth:!1,phase:d,capBottom:$,uRepeat:4}),u.box($,[.1,.4,.1],{at:[0,s+1.85,0]});let g=e=>p(e)*Math.cos(Math.PI/8),_=g(.5)+.02;u.quad(`door`,[[-.5,.35,_],[.5,.35,_],[.5,2.35,_-.1],[-.5,2.35,_-.1]],[[0,0],[1,0],[1,1],[0,1]]),u.box($,[1.3,.18,.22],{at:[0,2.42,_-.06]});for(let e of[-1,1])u.box($,[.15,2.1,.2],{at:[e*.58,1.38,_-.04],rot:[-.05,0,0],rotUV:!0});u.box(`stone_brick`,[1.5,.35,.6],{at:[0,.175,_+.25],faces:{ny:!1}});let v=e.windowMaterial();for(let[e,t]of[[3.5,0],[4.6,Math.PI/4*3]]){u.push([0,0,0],t);let n=g(e+.5)+.03;u.quad(v,[[-.4,e,n],[.4,e,n-.01],[.4,e+.8,n-.07],[-.4,e+.8,n-.06]],[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]),u.box($,[1,.08,.2],{at:[0,e-.04,n+.04]}),u.box($,[.96,.1,.14],{at:[0,e+.86,n-.03]}),u.pop()}let b=s-.35,x=g(b)+.2;u.box(`wood_planks`,[.9,.8,.9],{at:[0,b+.15,x-.35]}),u.box(c,[1.1,.12,1.1],{at:[0,b+.6,x-.35],rot:[.25,0,0]});let S=e.finish(u,`windmill`,t,n,r,o),C=e.builder(),w=e.extra.material(`sail`),T=i.sailLength??3.7;C.tube($,[0,0,-.1],[0,0,.45],.16,.14,{segments:8,capTop:$,uRepeat:2}),C.box(`metal`,[.36,.36,.08],{at:[0,0,.42],rot:[0,0,Math.PI/4]});for(let e=0;e<4;e++){C.push([0,0,.3],[0,0,e*Math.PI/2]),C.box($,[.13,T+.35,.12],{at:[0,(T+.35)/2-.15,0],rotUV:!0});let t=.55,n=T;C.quad(w,[[.07,t,.02],[1.02,t,.02],[1.02,n,.02],[.07,n,.02]],[[0,0],[1,0],[1,1],[0,1]],{normals:[[0,.3,.95],[0,.3,.95],[0,.3,.95],[0,.3,.95]]}),C.box(`wood_planks`,[.14,n-t,.03],{at:[-.14,(t+n)/2,.02],rotUV:!0}),C.pop()}let{group:E,geometries:D}=C.build(`windmill:sails`);e.track(D),E.position.set(0,b,x+.12),E.userData.dynamic=!0,E.rotation.z=a.range(0,Math.PI/2),S.add(E),S.updateMatrixWorld(!0);let O=i.speed??.55,k=e.result(S,{colliders:[{type:`circle`,x:t,z:r,r:1.75}],emissives:[{material:v,day:0,night:1.6}],update:e=>{E.rotation.z=(E.rotation.z-e*O*(.6+.4*Q.uWindStrength.value))%ps}});return k.sails=E,k}var bs=(e=.5,t=.62)=>(n,r)=>t+(1-t)*de(-.05,e,r);function xs(e,t,n,r,i,a,o={}){let s=e.rng(`fence`,(t+r)/2,(n+i)/2,o.seed),c=r-t,l=i-n,u=Math.hypot(c,l),d=Math.atan2(l,c)*-1,f=o.height??.95,p=Math.max(1,Math.round(u/(o.spacing??1))),m=u/p,h=e.builder(bs(.45)),g=[];for(let e=0;e<=p;e++){let t=-u/2+e*m,n=f+s.range(-.05,.04),r=[s.range(-.04,.04),0,s.range(-.04,.04)];g.push({px:t,h:n}),h.push([t,0,0],r),h.box($,[.15,n,.15],{at:[0,n/2-.05,0],rotUV:!0,faces:{ny:!1,py:!1},off:[s.range(0,2),s.range(0,2)]});let i=n-.05,a=.075,o=[0,i+.12,0],c=[[-.075,i,a],[a,i,a],[a,i,-.075],[-.075,i,-.075]];for(let e=0;e<4;e++)h.tri($,c[e],c[(e+1)%4],o,[0,0],[.15,0],[.075,.12]);h.pop()}let _=(o.rails??2)===1?[.62]:[.34,.7];for(let e=0;e<p;e++){let t=g[e],n=g[e+1];for(let e of _){let r=e*(t.h/f)+s.range(-.02,.02),i=e*(n.h/f)+s.range(-.02,.02),a=Math.hypot(m,i-r)+.12;h.box(`wood_planks`,[a,.1,.06],{at:[(t.px+n.px)/2,(r+i)/2,.09],rot:[0,0,Math.atan2(i-r,m)],off:[s.range(0,2),s.range(0,2)]})}}let v=e.finish(h,`fence`,(t+r)/2,a,(n+i)/2,d),y=[],b=Math.abs(Math.sin(2*d))>.05?Math.max(1,Math.ceil(m/.3)):1;for(let t=0;t<p;t++)for(let n=0;n<b;n++){let r=g[t].px+m*n/b;y.push(e.boxCollider(v,r,r+m/b,-.1,.1))}return e.result(v,{colliders:y})}function Ss(e,t,n,r,{h:i=1,r:a=.4,yaw:o=0,lid:s=!0,bottom:c=!1}={}){let l=[{y:0,r:a*.86},{y:i*.15,r:a*.95},{y:i*.5,r:a},{y:i*.85,r:a*.95},{y:i,r:a*.86}];e.lathe(`barrel`,l,{segments:10,uRepeat:3,vScale:i,at:[t,n,r],rot:o,smooth:!0});let u=s=>{e.push([t,n+i/2,r],s?[Math.PI,o,0]:[0,o,0]),e.lathe(`barrel`,[{y:i/2,r:a*.86},{y:i/2-.04,r:a*.78}],{segments:10,uRepeat:3,vScale:1,vOff:.9,capTop:`wood_planks`,color:[.8,.8,.8]}),e.pop()};s&&u(!1),c&&u(!0)}function Cs(e,t,n,r,i={}){let a=e.rng(`barrel`,t,r,i.seed),o=e.builder(bs(.5)),s=i.height??1,c=i.radius??.4;i.lying?(o.push([0,c*.95,-s/2],[Math.PI/2,0,0]),Ss(o,0,0,0,{h:s,r:c,yaw:a.range(0,6),bottom:!0}),o.pop()):Ss(o,0,0,0,{h:s,r:c,yaw:a.range(0,6)});let l=e.finish(o,`barrel`,t,n,r,i.rotation??a.range(0,Math.PI*2));return e.result(l,{colliders:[{type:`circle`,x:t,z:r,r:c+.04}]})}function ws(e,t,n,r,i={}){let a=e.rng(`crate`,t,r,i.seed),o=i.size??.9,s=e.builder(bs(.5));s.box(`crate`,[o,o,o],{at:[0,o/2,0],uv:`fit`,faces:{ny:!1}});let c=i.rotation??a.range(-.3,.3),l=e.finish(s,`crate`,t,n,r,c),u=o*.5*(Math.abs(Math.cos(c))+Math.abs(Math.sin(c)));return e.result(l,{colliders:[{type:`box`,minX:t-u,maxX:t+u,minZ:r-u,maxZ:r+u}]})}function Ts(e,t,n,r,i={}){let a=e.rng(`crateStack`,t,r,i.seed),o=e.builder(bs(.6)),s=i.size??.85,c=i.count??a.int(2,3),l=[];for(let e=0;e<c;e++){let t=(e-(c-1)/2)*(s+.04)+a.range(-.05,.05),n=a.range(-.08,.08),r=a.range(-.12,.12);l.push([t,n]),o.box(`crate`,[s,s,s],{at:[t,s/2,n],rot:r,uv:`fit`,faces:{ny:!1}})}let u=c>=3?a.int(1,2):1;for(let e=0;e<u;e++){let t=u===1?a.range(-.25,.25):(e-.5)*(s+.02);o.box(`crate`,[s*.92,s*.92,s*.92],{at:[t,s+s*.92/2,a.range(-.06,.06)],rot:a.range(-.35,.35),uv:`fit`,faces:{ny:!1}})}let d=c/2*(s+.04)+.06,f=-d,p=d;if(i.barrel??a.chance(.6)){let e=a.chance(.5)?1:-1,t=e*(c/2*(s+.04)+.3);Ss(o,t,0,a.range(.1,.4),{yaw:a.range(0,6)}),e>0?p=t+.42:f=t-.42}let m=i.rotation??a.range(-.4,.4),h=e.finish(o,`crateStack`,t,n,r,m);return e.result(h,{colliders:[e.boxCollider(h,f,p,-s*.6,s*.6)]})}function Es(e,t,n,r,i={}){let a=e.rng(`signpost`,t,r,i.seed),o=e.builder(bs(.5)),s=2.3;o.box($,[.16,s,.16],{at:[0,s/2-.05,0],rotUV:!0,faces:{ny:!1}}),o.box($,[.24,.08,.24],{at:[0,2.28,0]}),o.box($,[.1,.1,.1],{at:[0,2.36,0],rot:[0,Math.PI/4,0]});let c=i.boards??2;for(let e=0;e<c;e++){let t=1.8499999999999999-e*.55,n=e%2==0?1:-1,r=a.range(-.35,.35)+(e===1?a.range(-.5,.5):0);o.push([0,t,0],r);let i=1.15,s=.42,c=n*.595;o.box(`sign_board`,[i,s,.07],{at:[c,0,.09],faces:{pz:{off:[.8500000000000001/2,.5800000000000001/2-.02]},nz:{off:[.8500000000000001/2,.5800000000000001/2-.02]},py:$,ny:$,px:$,nx:$}});let l=c+n*i/2,u=.09-.035,d=.125,f=[l+n*.24,0,0],p=[l,s/2,0],m=[l,-.42/2,0];n>0?(o.tri(`sign_board`,[p[0],p[1],d],[m[0],m[1],d],[f[0],0,d],[.9,.7],[.9,.3],[1,.5]),o.tri(`sign_board`,[m[0],m[1],u],[p[0],p[1],u],[f[0],0,u],[.9,.3],[.9,.7],[1,.5])):(o.tri(`sign_board`,[m[0],m[1],d],[p[0],p[1],d],[f[0],0,d],[.1,.3],[.1,.7],[0,.5]),o.tri(`sign_board`,[p[0],p[1],u],[m[0],m[1],u],[f[0],0,u],[.1,.7],[.1,.3],[0,.5]));let h=n>0?[[p[0],p[1],d],[f[0],0,d],[f[0],0,u],[p[0],p[1],u]]:[[f[0],0,d],[p[0],p[1],d],[p[0],p[1],u],[f[0],0,u]],g=n>0?[[f[0],0,d],[m[0],m[1],d],[m[0],m[1],u],[f[0],0,u]]:[[m[0],m[1],d],[f[0],0,d],[f[0],0,u],[m[0],m[1],u]];o.quad($,h,[[0,0],[.3,0],[.3,.1],[0,.1]]),o.quad($,g,[[0,0],[.3,0],[.3,.1],[0,.1]]),o.box(`metal`,[.05,.05,.06],{at:[n*.1,.1,.14]}),o.box(`metal`,[.05,.05,.06],{at:[n*.1,-.1,.14]}),o.pop()}for(let t=0;t<3;t++){let t=a.range(0,Math.PI*2);ks(o,Math.cos(t)*.22,0,Math.sin(t)*.22,[.2,.14,.18],a,{detail:0,top:e.extra.material(`boulder_moss`),side:e.extra.material(`boulder`)})}let l=e.finish(o,`signpost`,t,n,r,i.rotation??0);return e.result(l,{colliders:[{type:`circle`,x:t,z:r,r:.22}],interact:{position:new p(t,n,r),radius:1.2,id:i.id??`signpost`}})}var Ds=new Map;function Os(e){let t=Ds.get(e);if(!t){let n=new i(1,e);t=n.getAttribute(`position`).array.slice(),n.dispose(),Ds.set(e,t)}return t}function ks(e,t,n,r,i,o,{top:s=`moss_stone`,side:c=`cliff`,detail:l=1,yaw:u=0,sink:d=.22,flatTop:f=0,tint:m=[1,1,1],rough:h=.3}={}){let g=Os(l),_=o.int(0,1e6),v=(e,t,n)=>{let r=Math.round(e*1e3),i=Math.round(t*1e3),o=Math.round(n*1e3),s=a(r*7+o,i*13-r,_);return 1-h/2+s*h},y=Math.cos(u),b=Math.sin(u),x=[];for(let e=0;e<g.length;e+=3){let a=g[e],o=g[e+1],s=g[e+2],c=v(a,o,s);a*=c*i[0],o*=c*i[1],s*=c*i[2],f&&o>i[1]*(1-f)&&(o=i[1]*(1-f)+(o-i[1]*(1-f))*.3),o=Math.max(o,-i[1]*d)+i[1]*d;let l=a*y+s*b,u=-a*b+s*y;x.push([t+l,n+o,r+u])}let S=new p,C=new p,w=new p;for(let t=0;t<x.length;t+=3){let r=x[t],a=x[t+1],o=x[t+2];if(S.fromArray(r),C.fromArray(a).sub(S),w.fromArray(o).sub(S),C.cross(w),C.lengthSq()<1e-10)continue;C.normalize();let l=C.y>.62?s:c,u=e.mat(l),d=e.units(u),f;f=C.y>.62||C.y<-.62?e=>[e[0]/d[0],-e[2]/d[1]]:Math.abs(C.x)>Math.abs(C.z)?e=>[-Math.sign(C.x)*e[2]/d[0],e[1]/d[1]]:e=>[Math.sign(C.z)*e[0]/d[0],e[1]/d[1]];let p=Math.min(r[1],a[1],o[1])-n,h=(.9+.25*O(C.y,0,1))*(.78+.22*O(p/Math.max(.01,i[1]),0,1)),g=C.y>.62?[h,h,h]:[h*m[0],h*m[1],h*m[2]];e.tri(u,r,a,o,f(r),f(a),f(o),{normal:[C.x,C.y,C.z],color:g})}}function As(e,t,n,r,i={}){let a=e.rng(`rock`,t,r,i.seed),o=i.size??1,s=e.builder(bs(.4*o,.7)),c=.7*o*a.range(.85,1.15),l=.62*o*a.range(.85,1.1),u=.62*o*a.range(.85,1.15),d={top:e.extra.material(`boulder_moss`),side:e.extra.material(`boulder`)};ks(s,0,0,0,[c,l,u],a,{...d,detail:+(o>.55),flatTop:i.flat?.3:.12});let f=o>=1?[c*.75,u*.55,Math.max(c,u)*.45]:null;if(f&&ks(s,f[0],0,f[1],[c*.5,l*.55,u*.5],a,{...d,detail:1,yaw:a.range(0,6)}),o>=.8)for(let e=0;e<2;e++){let e=a.range(0,Math.PI*2);ks(s,Math.cos(e)*(c+.2),0,Math.sin(e)*(u+.2),[.18*o,.12*o,.16*o],a,{...d,detail:0})}let m=e.finish(s,`rock`,t,n,r,i.rotation??a.range(0,Math.PI*2)),h=[{type:`circle`,x:t,z:r,r:Math.max(c,u)*.95}];if(f){let t=e.world(m,new p(f[0],0,f[1]));h.push({type:`circle`,x:t.x,z:t.z,r:f[2]})}return e.result(m,{colliders:h})}function js(e,t,n,r,i={}){let a=e.rng(`bench`,t,r,i.seed),o=e.builder(bs(.4)),s=i.length??1.8;for(let e of[-1,1])o.box(`stone_brick`,[.2,.42,.44],{at:[e*(s/2-.25),.21,0],faces:{ny:!1},off:[a.range(0,2),.3]});if(o.box(`wood_planks`,[s,.1,.24],{at:[0,.47,.1],faces:{ny:$}}),o.box(`wood_planks`,[s,.1,.24],{at:[0,.47,-.15],faces:{ny:$},off:[.6,.4]}),i.back!==!1){for(let e of[-1,1])o.box($,[.1,.7,.1],{at:[e*(s/2-.25),.8,-.26],rot:[-.12,0,0],rotUV:!0});o.box(`wood_planks`,[s-.1,.22,.07],{at:[0,1,-.3],rot:[-.12,0,0],off:[.3,.2]})}let c=i.rotation??0,l=e.finish(o,`bench`,t,n,r,c);return e.result(l,{colliders:[e.boxCollider(l,-s/2,s/2,-.35,.25)],interact:{position:e.world(l,new p(0,0,.6)),radius:.9,id:i.id??`bench`}})}function Ms(e,t,n,r,i={}){let a=e.rng(`haystack`,t,r,i.seed),o=i.size??1,s=e.builder(bs(.7*o,.6)),c=1*o,l=1.9*o,u=Array.from({length:12},()=>a.range(.9,1.08));s.lathe(`hay`,[{y:-.05,r:c*1.08},{y:l*.18,r:c*1.02},{y:l*.45,r:c*.9},{y:l*.7,r:c*.64},{y:l*.9,r:c*.3},{y:l,r:.05}],{segments:12,phase:a.range(0,1),smooth:!0,normalUp:.15,radiusFn:(e,t)=>e===0?u[t]*1.04:e<5?1+(u[(t+e)%12]-1)*.6:1,colorFn:e=>{let t=[.8,.9,1,1.05,1.08,1.1][e];return[t,t,t]}}),s.box($,[.09,.9*o,.09],{at:[.03,l+.3*o,.02],rot:[.08,0,.05],rotUV:!0});for(let e=0;e<4;e++){let e=a.range(0,Math.PI*2),t=c*a.range(1.05,1.25);s.lathe(`hay`,[{y:-.02,r:.28*o},{y:.14*o,r:.02}],{segments:6,at:[Math.cos(e)*t,0,Math.sin(e)*t],smooth:!0,normalUp:.5})}let d=e.finish(s,`haystack`,t,n,r,i.rotation??a.range(0,Math.PI*2));return e.result(d,{colliders:[{type:`circle`,x:t,z:r,r:c*1.05}]})}function Ns(e,t,n,r,i={}){let a=e.rng(`flowerbox`,t,r,i.seed),o=e.builder(i.wall?null:bs(.4)),s=i.length??1.2,c=.34,l=i.wall?0:.22;if(!i.wall)for(let e of[-1,1])for(let t of[-1,1])o.box($,[.07,l+.05,.07],{at:[e*(s/2-.06),(l+.05)/2,t*(c/2-.05)],rotUV:!0});qo(o,0,l,c/2,s,c,a.range(0,1));let u=e.finish(o,`flowerbox`,t,n,r,i.rotation??0);return e.result(u,{colliders:i.wall?[]:[e.boxCollider(u,-s/2,s/2,-.34/2,c/2)]})}var Ps=Math.PI*2,Fs=(e=.5,t=.62)=>(n,r)=>t+(1-t)*de(-.05,e,r),Is=[1.55,1.18,.52],Ls=[.34,.33,.36],Rs=[.5,.42,.38],zs=.4,Bs=Object.freeze({idle:`#3a8fb0`,attuned:`#7fe3ff`});function Vs(e,t,n,r,i={}){let a=e.rng(`chest`,t,r,i.seed),o=i.rotation??0,s=.88,c=.58,l=e.builder(Fs(.45));l.box($,[.92,.06,.62],{at:[0,.03,0],faces:{ny:!1}}),l.box(`wood_planks`,[.84,.32,.5399999999999999],{at:[0,.22,0],faces:{ny:!1,py:!1},off:[a.range(0,1),.1]});for(let e of[-1,1])for(let t of[-1,1])l.box($,[.07,.38,.07],{at:[e*(s/2-.02),.2,t*(c/2-.02)],rotUV:!0});for(let e of[-1,1])l.box($,[s,.05,.07],{at:[0,.375,e*(c/2-.035)],faces:{ny:!1}});for(let e of[-1,1])l.box($,[.07,.05,.43999999999999995],{at:[e*(s/2-.035),.375,0],faces:{ny:!1}});for(let e of[-1,1])l.box(`metal`,[.07,.30000000000000004,.6],{at:[e*.25,.21000000000000002,0],faces:{py:!1,ny:!1}});l.box(`metal`,[.17,.15,.03],{at:[0,.28,.3],color:Is,uv:`fit`}),l.box(`metal`,[.05,.06,.02],{at:[0,.26,.31999999999999995],color:[.25,.2,.18]}),l.box(`metal`,[.76,.04,.45999999999999996],{at:[0,.33,0],faces:{ny:!1},color:Is});for(let e=0;e<5;e++){let e=a.range(.07,.11);l.box(`metal`,[e,.03,e],{at:[a.range(-.3,.3),.365,a.range(-.16,.16)],rot:a.range(0,1.5),color:[1.8,1.4,.6]})}let u=e.finish(l,`chest`,t,n,r,o),d=e.builder(),f=c/2,m=[];for(let e=0;e<=6;e++){let t=e/6*Math.PI;m.push([f+Math.cos(t)*f,Math.sin(t)*.17+.04])}let h=l.mat(`wood_planks`),g=l.units(h),_=0;for(let e=0;e<6;e++){let[t,n]=m[e],[r,i]=m[e+1],a=Math.hypot(r-t,i-n),o=_/g[1],c=(_+a)/g[1];_+=a;let l=-.88/2/g[0],u=s/2/g[0];d.quad(h,[[-.88/2,n,t],[s/2,n,t],[s/2,i,r],[-.88/2,i,r]],[[l,o],[u,o],[u,c],[l,c]]);let p=.012/Math.max(.001,Math.hypot((t+r)/2-f,(n+i)/2-.04)),v=[(n-.04)*p,(t-f)*p],y=[(i-.04)*p,(r-f)*p];for(let e of[-1,1])d.quad(h,[[e*.25-.035,n+v[0],t+v[1]],[e*.25+.035,n+v[0],t+v[1]],[e*.25+.035,i+y[0],r+y[1]],[e*.25-.035,i+y[0],r+y[1]]],[[0,o],[.07,o],[.07,c],[0,c]],{color:Ls})}let v=e=>m.map(([t,n])=>[e*s/2,n,t]),y=v(1);d.poly(h,[[s/2,.04,0],[s/2,.04,c],...y.slice(1,-1)].reverse(),{uAxis:[0,0,1],vAxis:[0,1,0],normal:[1,0,0],color:Rs}),d.poly(h,[[-.88/2,.04,c],[-.88/2,.04,0],...v(-1).slice(1,-1).reverse()].reverse(),{uAxis:[0,0,-1],vAxis:[0,1,0],normal:[-1,0,0],color:Rs}),d.box(h,[.9,.045,.6],{at:[0,.022,f],faces:{py:!1},color:Rs}),d.box(h,[.1,.13,.025],{at:[0,-.02,.6],color:[1.9,1.45,.62]});let{group:b,geometries:x}=d.build(`chest:lid`);e.track(x),b.position.set(0,.4,-.29),b.userData.dynamic=!0,u.add(b),u.updateMatrixWorld(!0);let S=0,C={opened:!1,open(e=!1){return!C.opened&&(C.opened=!0,e&&(S=1,b.rotation.x=-1.95),!0)}},w=e.world(u,new p(0,0,.8));w.y=n;let T=e.result(u,{colliders:[{type:`circle`,x:t,z:r,r:.45}],interact:{position:w,radius:1.2,id:i.id??`chest`},update:e=>{if(!C.opened||S>=1)return;S=Math.min(1,S+e/zs);let t=1+2.2*(S-1)**3+1.2*(S-1)**2;b.rotation.x=-1.95*t}});return T.controls=C,T.lid=b,T}function Hs(e,t,n,r,i={}){let a=e.rng(`waystone`,t,r,i.seed),o=e.builder(Fs(.7,.55)),s={segments:8,smooth:!1,phase:Math.PI/8};o.lathe(`stone_brick`,[{y:-.06,r:.7},{y:.2,r:.66}],{...s,capTop:`stone_tiles`,uRepeat:4,vOff:.3}),o.lathe(`stone_brick`,[{y:.2,r:.5},{y:.38,r:.47}],{...s,capTop:`stone_tiles`,uRepeat:3,vOff:.1});let c=.34,l={segments:4,smooth:!1,phase:Math.PI/4};o.lathe(`stone_brick`,[{y:.36,r:c},{y:2,r:.25}],{...l,uRepeat:2,colorFn:e=>e===0?[.86,.96,.8]:[1.12,1.1,1.04]}),o.box(`stone_tiles`,[.5,.1,.5],{at:[0,2.04,0]}),o.box(`stone_brick`,[.4,.07,.4],{at:[0,2.125,0],off:[.3,.2]});for(let e=0;e<4;e++){let t=Math.PI/4+e*Math.PI/2,n=Math.cos(t)*.17,r=-Math.sin(t)*.17;o.tube(`metal`,[n,2.14,r],[n*1.25,2.36,r*1.25],.028,.02,{segments:4,uRepeat:1})}for(let t=0;t<2;t++){let t=a.range(0,Ps),n=a.range(.1,.16);e.rockGeom(o,Math.cos(t)*.82,0,Math.sin(t)*.82,[n*1.3,n,n*1.1],a,{top:e.extra.material(`boulder_moss`),side:e.extra.material(`boulder`),detail:0,yaw:t})}let u=e.finish(o,`waystone`,t,n,r,0),d=e.textures.material(`plaster`,{vertexColors:!0}).clone();d.name=`luminati:waystone-crystal`,d.color.set(`#6aa6b5`),d.emissive=new G(Bs.idle),d.emissiveIntensity=.9,d.userData.castShadow=!1;let f=e.builder(),m=e=>(c+-.09000000000000002*(e-.36)/1.6400000000000001)*Math.SQRT1_2,h=[[[0,-1,0,1],[0,.4,.55,.95],[0,-.1,.55,.4]],[[-.45,-1,-.45,1],[.45,-1,.45,1],[-.45,.6,.45,-.2]],[[0,-1,0,1],[-.5,.5,.5,-.1],[.5,.5,-.5,-.1]],[[-.5,1,.5,0],[.5,0,-.5,-1],[0,-1,0,1]]],g=(e,t,n,r,i)=>{let a=Math.hypot(r-t,i-n)||1,o=-(i-n)/a*.022,s=(r-t)/a*.022,c=(t,n)=>{let r=m(n)+.012,i=Math.cos(e),a=Math.sin(e);return[i*r+a*t,n,-a*r+i*t]};f.quad(d,[c(t+o,n+s),c(r+o,i+s),c(r-o,i-s),c(t-o,n-s)],[[0,0],[1,0],[1,1],[0,1]])};for(let e=0;e<4;e++){let t=e*Math.PI/2;for(let n=0;n<3;n++){let r=h[(e+n+a.int(0,3))%h.length],i=.72+n*.42;for(let[e,n,a,o]of r)g(t,e*.07,i+n*.1,a*.07,i+o*.1)}}let{group:_,geometries:v}=f.build(`waystone:runes`);e.track(v),_.userData.dynamic=!0,u.add(_);let y=e.builder(),b=.2,x=[0,.44,0],S=[0,-.3,0],C=[0,1,2,3].map(e=>[Math.cos(e*Math.PI/2)*b,0,-Math.sin(e*Math.PI/2)*b]);for(let e=0;e<4;e++){let t=C[e],n=C[(e+1)%4];y.tri(d,t,n,x,[0,0],[.4,0],[.2,.44],{color:e%2?[1.15,1.2,1.25]:[.95,1,1.05]}),y.tri(d,n,t,S,[.4,0],[0,0],[.2,.3],{color:e%2?[.62,.72,.82]:[.5,.6,.72]})}let{group:T,geometries:E}=y.build(`waystone:crystal`);e.track(E);let D=2.62;T.position.set(0,D,0),T.rotation.y=a.range(0,Ps),T.userData.dynamic=!0,u.add(T);let O=1.7,k=new Ee(O,O);e.track([k]);let A=Co({color:Bs.idle,intensity:.34,seed:a.range(0,100),day:.8}),j=new R(k,A);j.name=`waystone:glow`,j.renderOrder=w.PARTICLES+5,j.castShadow=!1,j.receiveShadow=!1,j.position.y=.05,T.add(j),u.updateMatrixWorld(!0);let M={attuned:!1,setAttuned(e){return M.attuned=!!e,d.emissive.set(e?Bs.attuned:Bs.idle),A.uniforms.uColor.value.set(e?Bs.attuned:Bs.idle),A.uniforms.uIntensity.value=e?.62:.34,M.attuned}},N=a.range(0,10),P=e.result(u,{colliders:[{type:`circle`,x:t,z:r,r:.5}],emissives:[{material:d,day:.9,night:1.6}],interact:{position:new p(t,n,r),radius:1.5,id:i.id??`waystone`},materials:[d,A],update:e=>{N=(N+e)%1e3,T.position.y=D+Math.sin(N*1.7)*.06,T.rotation.y=(T.rotation.y+e*.7)%Ps}});return P.controls=M,P.crystal=T,P}var Us=Math.PI*2,Ws=`furniture_wood`,Gs=(e=.5,t=.62)=>(n,r)=>t+(1-t)*de(-.05,e,r),Ks=(e,t,n,r)=>{let i=typeof e==`number`?e:typeof e==`string`&&e.trim()?Number(e):NaN;return O(Number.isFinite(i)?i:t,n,r)},qs=(e,t,n)=>e.includes(t)?t:n,Js=[`red`,`blue`,`green`,`ochre`,`plum`],Ys=[`red`,`blue`,`green`],Xs=[1.3,1.3,1.36],Zs=[1.05,.62,.45];function Qs(e,t,n,r,i=.16){e.lathe(`linen`,[{y:n,r:i*.62},{y:n+.018,r:i},{y:n+.028,r:i*1.02}],{segments:10,smooth:!1,capTop:`linen`,at:[t,0,r],color:[1.02,1,.98]})}function $s(e,t,n,r,i=0){e.lathe(`metal`,[{y:n,r:.075},{y:n+.17,r:.08}],{segments:8,capTop:$,at:[t,0,r],color:Xs}),e.box(`metal`,[.03,.1,.06],{at:[t+Math.cos(i)*.1,n+.09,r-Math.sin(i)*.1],rot:i,color:Xs})}function ec(e,t,n,r){e.lathe(`linen`,[{y:n,r:.08},{y:n+.1,r:.115},{y:n+.21,r:.075},{y:n+.29,r:.06},{y:n+.31,r:.07}],{segments:9,capTop:$,at:[t,0,r],color:Zs})}function tc(e,t,n,r,i=0){e.push([t,n,r],i,[1.45,1,.9]),e.lathe(`hay`,[{y:0,r:.1},{y:.05,r:.11},{y:.09,r:.07},{y:.105,r:.01}],{segments:8,color:[1,.68,.38],normalUp:.3}),e.pop()}function nc(e,t,n,r,i=.18){return e.lathe(`metal`,[{y:n,r:.08},{y:n+.02,r:.07},{y:n+.035,r:.035}],{segments:8,smooth:!1,capTop:`metal`,at:[t,0,r],color:Xs}),e.lathe(`linen`,[{y:n+.03,r:.032},{y:n+.03+i,r:.03}],{segments:6,capTop:`linen`,at:[t,0,r],color:[1.05,1,.86]}),new p(t,n+.03+i,r)}function rc(e,t,n,r,i={}){let a=e.rng(`bed`,t,r,i.seed),o=Ks(i.width,1.2,.8,2.4),s=Ks(i.length,2.2,1.6,2.8),c=`quilt_${qs(Js,i.blanket,`red`)}`,l=e.builder(Gs(.7)),u=o/2,d=s/2;for(let e of[-1,1]){for(let[t,n]of[[-d+.06,1.2],[d-.06,.75]])l.box($,[.12,n,.12],{at:[e*(u-.01),n/2,t],rotUV:!0,faces:{ny:!1}}),l.box($,[.16,.05,.16],{at:[e*(u-.01),n+.025,t],faces:{ny:!1}}),l.box($,[.08,.07,.08],{at:[e*(u-.01),n+.085,t],faces:{ny:!1}});l.box(Ws,[.07,.2,s-.24],{at:[e*(u-.02),.3,0],faces:{ny:!1}})}let f=e.textures.meta(Ws).units[0];l.box(Ws,[o-.12,.72,.06],{at:[0,.7,-d+.06],rotUV:!0,faces:{ny:!1,pz:{off:[0,Wo(o-.12,f)]}}}),l.box($,[o-.08,.09,.1],{at:[0,1.1,-d+.06]}),l.box(Ws,[o-.12,.3,.06],{at:[0,.4,d-.06],rotUV:!0,faces:{ny:!1}}),l.box($,[o-.08,.07,.1],{at:[0,.585,d-.06]}),l.box(`linen`,[o-.12,.2,s-.22],{at:[0,.4600000000000001,0],faces:{ny:!1}});let p=-d+.72,m=d-.11,h=m-p,g=(p+m)/2,_=e.textures.meta(c).units[0];l.box(c,[o+.1,.05,h],{at:[0,.5850000000000001,g],faces:{ny:!1,py:{off:[Wo(o+.1,_),0]}}});for(let e of[-1,1])l.box(c,[.035,.34,h],{at:[e*(u+.0325),.44000000000000006,g],faces:{ny:!1,py:!1}});l.box(`linen`,[o+.06,.06,.15],{at:[0,.6050000000000001,p+.04],faces:{ny:!1}});let v=o>=1.6?2:1,y=(o-.26)/v-(v>1?.05:0);for(let e=0;e<v;e++){let t=v===1?0:(e-.5)*(y+.08),n=-.35+a.range(-.04,.04);l.box(`linen`,[y,.13,.42],{at:[t,.67,-d+.37],rot:[n,a.range(-.05,.05),0],color:[1.03,1.03,1.03]}),l.box(`linen`,[y-.1,.05,.3],{at:[t,.75,-d+.355],rot:[n,0,0],color:[1.05,1.05,1.05]})}let b=e.finish(l,`bed`,t,n,r,i.rotation??0);return e.result(b,{colliders:e.boxColliders(b,-u-.05,u+.05,-d,d)})}function ic(e,t,n,r,i={}){let a=e.rng(`table`,t,r,i.seed),o=i.shape===`round`,s=Ks(i.width,o?1.2:1.6,.6,3.2),c=o?s:Ks(i.depth,.9,.6,2),l=.82,u=i.cloth===!0,d=e.builder(Gs(.55)),f=s/2;if(o){d.lathe(Ws,[{y:.75,r:f-.03},{y:.7899999999999999,r:f},{y:l,r:f-.01}],{segments:18,smooth:!0,capTop:Ws,capBottom:$,color:[.92,.9,.9]}),d.tube($,[0,.08,0],[0,.75,0],.075,.065,{segments:8}),d.lathe($,[{y:.3,r:.07},{y:.36,r:.11},{y:.42,r:.07}],{segments:8});for(let e=0;e<4;e++){let t=Math.PI/4+e*Math.PI/2,n=f*.8;d.box($,[n,.08,.1],{at:[Math.cos(t)*n/2,.04,-Math.sin(t)*n/2],rot:t,faces:{ny:!1}}),d.box($,[.13,.05,.13],{at:[Math.cos(t)*n,.025,-Math.sin(t)*n],rot:t,faces:{ny:!1}})}}else{let t=e.textures.meta(Ws).units;d.box(Ws,[s,.07,c],{at:[0,.7849999999999999,0],faces:{py:{off:[Wo(s,t[0]),Wo(c,t[1])]},ny:$,px:$,nx:$,pz:$,nz:$}}),d.box($,[s-.22,.12,c-.22],{at:[0,.69,0],faces:{py:!1,ny:!1}});for(let e of[-1,1])for(let t of[-1,1])d.box($,[.09,.75,.09],{at:[e*(s/2-.11),.75/2,t*(c/2-.11)],rotUV:!0,faces:{ny:!1,py:!1}}),d.box($,[.12,.05,.12],{at:[e*(s/2-.11),.025,t*(c/2-.11)],faces:{ny:!1}})}let p=l;if(u){let e=[1,.99,.96];if(o)d.lathe(`linen`,[{y:.58,r:f+.08},{y:.7899999999999999,r:f+.03},{y:.832,r:f+.02}],{segments:18,smooth:!0,capTop:`linen`,color:e});else{d.box(`linen`,[s+.04,.015,c+.04],{at:[0,.827,0],faces:{ny:!1},color:e});for(let t of[-1,1])d.box(`linen`,[s+.04,.22,.015],{at:[0,.72,t*(c/2+.0275)],faces:{py:!1,ny:!1},color:e});for(let t of[-1,1])d.box(`linen`,[.015,.22,c+.07],{at:[t*(s/2+.0275),.72,0],faces:{py:!1,ny:!1},color:e})}p=.835}let m=[],h=(e,t,n)=>m.every(([r,i,a])=>Math.hypot(e-r,t-i)>n+a),g=e=>{for(let t=0;t<10;t++){let t,n;if(o){let r=a.range(0,Us),i=Math.sqrt(a.next())*Math.max(0,f-e-.08);t=Math.cos(r)*i,n=Math.sin(r)*i}else t=a.range(-s/2+e+.08,s/2-e-.08),n=a.range(-c/2+e+.08,c/2-e-.08);if(h(t,n,e))return m.push([t,n,e]),[t,n]}return null},_=[],v=null;if(i.candle===!0&&(m.push([0,0,.1]),v=nc(d,0,p,0)),i.items!==!1){let e=O(Math.round(s*c*2.2),2,6),t=[`plate`,`mug`,`plate`,`jug`,`mug`,`bread`];for(let n=0;n<e;n++){let e=t[(n+a.int(0,1))%t.length],r=g(e===`plate`||e===`bread`?.17:.1);r&&(e===`plate`?(Qs(d,r[0],p,r[1]),a.chance(.5)&&tc(d,r[0],p+.025,r[1],a.range(0,Us))):e===`mug`?$s(d,r[0],p,r[1],a.range(0,Us)):e===`jug`?ec(d,r[0],p,r[1]):tc(d,r[0],p,r[1],a.range(0,Us)))}}let y=e.finish(d,`table`,t,n,r,i.rotation??0);if(v){let t=e.flame({width:.14,height:.22,seed:a.range(0,100),glowSize:3,glowIntensity:.45});t.object.position.copy(v),y.add(t.object),y.updateMatrixWorld(!0),_.push(t)}return e.result(y,{colliders:o?[{type:`circle`,x:t,z:r,r:f+.02}]:e.boxColliders(y,-s/2,s/2,-c/2,c/2),flames:_})}function ac(e,t,n,r,i={}){let a=e.rng(`chair`,t,r,i.seed),o=i.style===`stool`,s=e.builder(Gs(.45));if(o){s.lathe(Ws,[{y:.44,r:.18},{y:.48,r:.2},{y:.5,r:.19}],{segments:10,smooth:!0,capTop:Ws,capBottom:$});let e=a.range(0,Us);for(let t=0;t<3;t++){let n=e+t*Us/3;s.tube($,[Math.cos(n)*.21,0,Math.sin(n)*.21],[Math.cos(n)*.11,.45,Math.sin(n)*.11],.03,.028,{segments:5})}for(let t=0;t<3;t++){let n=e+t*Us/3,r=n+Us/3,i=.175;s.tube($,[Math.cos(n)*i,.2,Math.sin(n)*i],[Math.cos(r)*i,.2,Math.sin(r)*i],.016,.016,{segments:4})}}else{let e=.46,t=e/2-.04;s.box(Ws,[e,.06,e],{at:[0,.47,0]});for(let e of[-1,1]){for(let n of[-1,1])s.box($,[.06,.43999999999999995,.06],{at:[e*t,.43999999999999995/2,n*t],rotUV:!0,faces:{ny:!1,py:!1}});s.box($,[.035,.035,.36],{at:[e*t,.15,0],faces:{ny:!1}}),s.box($,[.06,.62,.06],{at:[e*t,.78,-.202],rot:[-.08,0,0],rotUV:!0,faces:{ny:!1}})}s.box($,[.36,.035,.035],{at:[0,.22,t]}),s.box(Ws,[.44,.11,.045],{at:[0,1.02,-.23],rot:[-.08,0,0]}),s.box(Ws,[.36,.07,.035],{at:[0,.79,-.215],rot:[-.08,0,0]})}let c=e.finish(s,o?`stool`:`chair`,t,n,r,i.rotation??0);return e.result(c,{colliders:[{type:`circle`,x:t,z:r,r:o?.22:.27}]})}function oc(e,t,n,r,i={}){let a=e.rng(`shelf`,t,r,i.seed),o=i.kind===`pantry`,s=Ks(i.width,1.6,.8,3.2),c=Ks(i.height,2.2,1,3),l=s/2,u=e.builder(Gs(.4));for(let e of[-1,1])u.box(Ws,[.07,c-.07,.48],{at:[e*(l-.035),(c-.07)/2,0],rotUV:!0,faces:{ny:!1}});u.box($,[s+.08,.08,.54],{at:[0,c-.04,.01]}),u.box($,[s-.02,.12,.46],{at:[0,.06,0],faces:{ny:!1}}),u.box($,[s-.12,c-.18,.03],{at:[0,.12+(c-.18)/2,-.22],faces:{ny:!1,py:!1},color:[.7,.66,.64]});let d=o?`pantry`:`books`,f=s-.14,p=f/2,m=.5,h=.05,g=.12,_=c-.08-.12,v=Math.max(1,Math.floor((_+h+1e-6)/.55)),y=(_-(v-1)*h)/v;for(let e=0;e<v;e++){let t=.12+e*(y+h),n=a.int(0,31)/32;u.quad(d,[[-p,t,g],[p,t,g],[p,t+m,g],[-p,t+m,g]],[[n,0],[n+f/2,0],[n+f/2,1],[n,1]]),e<v-1&&u.box(Ws,[f,h,.45],{at:[0,t+y+h/2,-.01]})}let b=c;o?(ec(u,-l*.5,b,.02),u.box(`burlap`,[.36,.16,.28],{at:[l*.35,b+.08,0],rot:a.range(-.3,.3),faces:{ny:!1}})):(u.box(`crate`,[.3,.2,.26],{at:[-l*.45,b+.1,0],rot:a.range(-.25,.25),uv:`fit`,faces:{ny:!1}}),s>=1.2&&(u.box(Ws,[.34,.06,.24],{at:[l*.4,b+.03,.02],rot:.15,color:[.75,.4,.35]}),u.box(Ws,[.3,.05,.22],{at:[l*.4,b+.085,0],rot:-.1,color:[.45,.55,.85]})));let x=e.finish(u,`shelf`,t,n,r,i.rotation??0);return e.result(x,{colliders:e.boxColliders(x,-l,l,-.25,.25)})}var sc=Object.freeze({day:1.3,night:1.9});function cc(e,t,n,r,i={}){let a=e.rng(`hearth`,t,r,i.seed),o=Ks(i.width,2.2,1.6,3.6),s=Ks(i.height,2.6,1.8,4.5),c=i.lit!==!1,l=e.builder(Gs(.9)),u=.7,d=Math.min(.5,o*.22),f=o-2*d,m=1.2,h=`stone_brick`,g=[.42,.36,.34],_=e.textures.meta(h).units[0];l.box(`stone_brick`,[o+.3,.1,.36],{at:[0,.05,.31999999999999995],faces:{ny:!1},off:[.2,0]}),l.box(`stone_brick`,[f,.1,.5399999999999999],{at:[0,.05,-.13000000000000006],faces:{ny:!1,pz:!1},color:g});for(let e of[-1,1]){let t=e<0?`px`:`nx`;l.box(h,[d,m,u],{at:[e*(o/2-d/2),m/2,-.15000000000000002],faces:{ny:!1,py:!1,nz:!1,[t]:{color:g}},off:[e>0?.37:0,0]})}l.box(h,[o,.34,u],{at:[0,1.3699999999999999,-.15000000000000002],faces:{nz:!1,ny:{color:[.3,.26,.25]},pz:{off:[Wo(o,_),.2]}}}),l.box(h,[f,m,.1],{at:[0,m/2,-.45],faces:{nz:!1,ny:!1,py:!1,px:!1,nx:!1},color:[.36,.3,.29]});let v=1.54;l.box($,[o+.26,.1,.86],{at:[0,1.59,-.07]}),l.box($,[o+.1,.06,.76],{at:[0,1.51,-.12],faces:{py:!1}});let y=o-.36;l.box(h,[y,s-v-.1,.49999999999999994],{at:[0,(s+v+.1)/2,-.25],faces:{ny:!1,nz:!1,pz:{off:[Wo(y,_),.1]}}}),l.box(h,[y+.12,.12,.5599999999999999],{at:[0,1.7,-.22000000000000003],faces:{nz:!1}});let b=1.6400000000000001,x=.16999999999999996;nc(l,-o/2+.28,b,x,.16),o>=2&&nc(l,-o/2+.5,b,.18999999999999995,.11),ec(l,o/2-.32,b,x);let S=-.13,C=c?e.textures.material(`embers`,{vertexColors:!0,emissiveIntensity:0,emissive:new G(16738846)}):e.extra.material(`ash`);l.box(C,[f-.08,.05,.39999999999999997],{at:[0,.125,S],faces:{ny:!1}});let w=Math.min(f*.72,1.1);for(let[e,t,n]of[[-.23,.2,.3],[-.04000000000000001,.19,1.2]])l.tube(`bark`,[-w/2,t,e],[w/2,t+.02,e+a.range(-.05,.05)],.075,.07,{segments:6,capTop:C,capBottom:C,twist:n,color:c?[.55,.42,.4]:[.4,.36,.36]});l.tube(`bark`,[-.15,.17,.07],[.12,.42,-.25],.06,.05,{segments:6,capTop:C,twist:.4,color:[.5,.4,.38]});for(let e of[-1,1]){let t=e*(f/2-.16);l.box(`metal`,[.05,.05,.42],{at:[t,.16,S],faces:{ny:!1}}),l.box(`metal`,[.06,.22,.06],{at:[t,.24,.07]}),l.box(`metal`,[.09,.07,.09],{at:[t,.38,.07]})}i.pot===!0&&(l.box(`metal`,[.025,.44999999999999996,.025],{at:[0,m-.44999999999999996/2,-.19]}),l.lathe(`metal`,[{y:.5,r:.09},{y:.56,r:.16},{y:.7,r:.155},{y:.73,r:.13}],{segments:10,smooth:!0,capBottom:`metal`,capTop:l.mat($),at:[0,0,-.19],color:[.62,.6,.62]}),l.box(`metal`,[.34,.025,.025],{at:[0,.77,-.19]}));let T=e.finish(l,`hearth`,t,n,r,i.rotation??0),E=[],D=[],O=[],k=[];if(c){let t=e.flame({width:Math.min(.95,f*.7),height:.95,seed:a.range(0,100),glowSize:2,glowIntensity:.5});t.object.position.set(0,.14,-.15),T.add(t.object),T.updateMatrixWorld(!0),E.push(t),k.push({material:C,...sc}),D.push({position:e.world(T,new p(0,.75,.5499999999999999)),color:16747066,intensity:i.intensity??10,distance:i.distance??9,flicker:.5,nightOnly:!1}),i.embers!==!1&&O.push({preset:`embers`,position:e.world(T,new p(0,.55,S)),rate:3})}return e.result(T,{colliders:e.boxColliders(T,-o/2-.15,o/2+.15,-.5,.5),lights:D,emissives:k,emitters:O,flames:E})}function lc(e,t,n,r,i={}){let a=e.rng(`counter`,t,r,i.seed),o=Ks(i.width,2.6,1.2,6),s=i.style===`shop`,c=o/2,l=e.builder(Gs(.5));l.box($,[o-.04,.12,.62],{at:[0,.06,-.02],faces:{ny:!1}});let u=e.textures.meta(Ws).units[0];l.box(Ws,[o-.06,.8700000000000001,.58],{at:[0,.555,-.04],rotUV:!0,faces:{ny:!1,py:!1}});let d=Math.max(2,Math.round(o/.8)+1),f=-.04+.58/2+.02;for(let e=0;e<d;e++){let t=-c+.07+e*(o-.14)/(d-1);l.box($,[.08,.8300000000000001,.04],{at:[t,.535,f],rotUV:!0,faces:{ny:!1}})}if(l.box($,[o-.04,.07,.05],{at:[0,.92,f]}),l.box($,[o-.04,.05,.05],{at:[0,.16,f]}),l.box(Ws,[o+.08,.07,.7799999999999999],{at:[0,1.0150000000000001,.03],faces:{py:{off:[Wo(o+.08,u),0]},ny:$,px:$,nx:$,pz:$,nz:$}}),i.items!==!1){let e=1.05;if(s){let t=-c*.45;l.box(`metal`,[.3,.04,.16],{at:[t,1.07,-.05]}),l.box(`metal`,[.04,.42,.04],{at:[t,1.28,-.05]}),l.box(`metal`,[.56,.03,.03],{at:[t,1.49,-.05],rot:[0,0,.06]});for(let e of[-1,1])l.box(`metal`,[.012,.22,.012],{at:[t+e*.26,1.3800000000000001+e*.016,-.05]}),l.lathe(`metal`,[{y:0,r:.04},{y:.04,r:.13}],{segments:8,at:[t+e*.26,1.25+e*.016,-.05],capBottom:`metal`,color:[1.05,.85,.55]});l.box(`linen`,[.36,.04,.26],{at:[c*.05,1.07,.05],rot:.12}),l.box(Ws,[.38,.02,.28],{at:[c*.05,1.055,.05],rot:.12,color:[.8,.35,.3]});for(let t=0;t<2+ +(o>2.2);t++){let n=c*.4+t*.24;if(n>c-.15)break;l.lathe(`linen`,[{y:e,r:.08},{y:1.25,r:.085},{y:1.28,r:.06}],{segments:8,capTop:`metal`,at:[n,0,-.1+a.range(-.05,.05)],color:[[.7,.95,.75],[1.05,.7,.5],[.85,.75,1.05]][t%3]})}}else{let t=o>=1.8,n=t?c-.38:c+1,r=Math.max(2,Math.floor((o-(t?.9:.3))/.45));for(let t=0;t<r;t++){let r=-c+.3+t*.45+a.range(-.06,.06);if(r>n-.4)break;$s(l,r,e,.12+a.range(-.04,.04),a.range(0,Us))}for(let t=0;t<2;t++){let n=-c+.4+t*.22+a.range(-.04,.04);l.lathe(`metal`,[{y:e,r:.06},{y:1.25,r:.06},{y:1.31,r:.025},{y:1.37,r:.022}],{segments:6,capTop:$,at:[n,0,-.16],color:[.35,.6,.4]})}if(t){for(let e of[-1,1])l.box($,[.06,.12,.4],{at:[n+e*.18,1.11,-.02],faces:{ny:!1}});l.push([n,1.32,-.02],[0,0,Math.PI/2]),Ss(l,0,-.27,0,{h:.54,r:.24,yaw:a.range(0,6),bottom:!0}),l.pop(),l.box(`metal`,[.06,.06,.08],{at:[n-.3,1.29,-.02]})}}}let p=e.finish(l,`counter`,t,n,r,i.rotation??0);return e.result(p,{colliders:e.boxColliders(p,-c,c,-.35,.41)})}function uc(e,t,n,r,i={}){let a=e.rng(`rug`,t,r,i.seed),o=Ks(i.width,2,1,6),s=Ks(i.length,3,1,8),c={userData:{castShadow:!1}},l=e.builder(),u=l.mat(`rug_${qs(Ys,i.color,`red`)}`,c),d=l.mat(`rug_border`,c),f=.025,p=Math.min(.375,o/5,s/5),m=o/2,h=s/2;l.box(u,[o-2*p,f,s-2*p],{at:[0,f/2,0],faces:{py:{off:[Wo(o-2*p,2),Wo(s-2*p,2)]},ny:!1,pz:!1,nz:!1,px:!1,nx:!1}});let g=1-p*16/8,_=(e,t,n,r,i)=>l.quad(d,[[e,f,r],[t,f,r],[t,f,n],[e,f,n]],i);if(_(-m,m,h-p,h,[[0,1],[o,1],[o,g],[0,g]]),_(-m,m,-h,-h+p,[[0,g],[o,g],[o,1],[0,1]]),l.quad(d,[[m-p,f,h-p],[m,f,h-p],[m,f,-h+p],[m-p,f,-h+p]],[[0,g],[0,1],[s-2*p,1],[s-2*p,g]]),l.quad(d,[[-m,f,h-p],[-m+p,f,h-p],[-m+p,f,-h+p],[-m,f,-h+p]],[[s-2*p,1],[s-2*p,g],[0,g],[0,1]]),l.box(d,[o,f,s],{at:[0,f/2,0],faces:{py:!1,ny:!1}}),i.fringe!==!1){let e=l.mat(`linen`,c);for(let t of[-1,1])for(let n=-m+.06;n<m-.06;n+=.125){let r=.1+a.range(0,.05),i=t*h,o=t*(h+r),s=t>0?[[n,.008,o],[n+.0625,.008,o],[n+.0625,.008,i],[n,.008,i]]:[[n,.008,i],[n+.0625,.008,i],[n+.0625,.008,o],[n,.008,o]];l.quad(e,s,[[0,0],[.06,0],[.06,r],[0,r]],{color:[.98,.92,.8]})}}let v=e.finish(l,`rug`,t,n,r,i.rotation??0);return e.result(v,{colliders:[]})}function dc(e,t,n,r,i={}){let a=e.rng(`staircase`,t,r,i.seed),o=i.dir===`down`,s=Ks(i.width,1.2,.8,2.4),c=Math.round(Ks(i.steps,7,3,14)),l=i.rail!==!1,u=e.builder(Gs(.6));if(!o){let o=Ks(i.height,2.5,1,5),d=i.flip===!0?-1:1,f=.4,p=c*f,m=o/c,h=s/2;for(let e=0;e<c;e++){let t=(e+1)*m,n=d*(-p/2+(e+.5)*f),r=Math.min(n-f/2,n+f/2)+p/2;u.box(Ws,[f,t,s],{at:[n,t/2,0],faces:{ny:!1,nz:!1,pz:{off:[r,0],color:[.86,.82,.8]},py:{rotUV:!0,off:[0,Math.round(a.range(0,32))/16]},px:d>0&&e<c-1?!1:{color:[.7,.66,.64]},nx:d<0&&e<c-1?!1:{color:[.7,.66,.64]}}}),u.box($,[.06,.05,s+.02],{at:[n-d*(f/2-.02),t-.02,.01],faces:{ny:!1}})}if(l){let e=.95,t=-d*p/2+d*.08;u.box($,[.12,e+m+.1,.12],{at:[t,(e+m+.1)/2,h-.06],rotUV:!0,faces:{ny:!1}}),u.box($,[.16,.06,.16],{at:[t,e+m+.13,h-.06]}),u.box($,[.09,.09,.09],{at:[t,e+m+.2,h-.06],rot:[0,Math.PI/4,0]});let n=d*(p/2-.06);u.box($,[.1,e,.1],{at:[n,o+e/2,h-.06],rotUV:!0});for(let e=1;e<c-1;e++){let t=d*(-p/2+(e+.5)*f),n=(e+1)*m;u.box($,[.04,.8999999999999999,.04],{at:[t,n+.8999999999999999/2,h-.06],rotUV:!0})}let r=e+m+.05,i=o+e-.02,a=t,s=n,l=Math.hypot(s-a,i-r);u.box($,[l,.07,.08],{at:[(a+s)/2,(r+i)/2,h-.06],rot:[0,0,Math.atan2(i-r,s-a)]})}let g=e.finish(u,`staircase`,t,n,r,i.rotation??0);return e.result(g,{colliders:e.boxColliders(g,-p/2,p/2,-h,h+.04)})}let d=c*.38,f=s/2,p=d/2,m=e.textures.material(`stone_wall`,{vertexColors:!0});u.box(m,[s,.01,d],{at:[0,.004,0],faces:{ny:!1,pz:!1,nz:!1,px:!1,nx:!1},color:[.05,.045,.05]});let h=0;for(let e=0;e<c;e++)h+=.86**e;let g=p;for(let e=0;e<c;e++){let t=d*.86**e/h,n=.04+.86*(1-e/c)**2,r=g-t;u.box(Ws,[s-.24,.012,t-.06],{at:[0,.012,g-(t-.06)/2],faces:{ny:!1,pz:!1,nz:!1,px:!1,nx:!1,py:{rotUV:!0,off:[0,Math.round(a.range(0,32))/16]}},color:[n,n*.95,n*.92]}),u.box(m,[s-.24,.012,.06],{at:[0,.013,r+.03],faces:{ny:!1},color:[n*.2,n*.18,n*.2]}),g=r}for(let e of[-1,1])u.quad(m,e<0?[[-f,.016,p],[-f+.12,.016,p],[-f+.12,.016,-p],[-f,.016,-p]]:[[f-.12,.016,p],[f,.016,p],[f,.016,-p],[f-.12,.016,-p]],[[0,0],[.12,0],[.12,d],[0,d]],{colors:[[.3,.27,.27],[.3,.27,.27],[.03,.03,.035],[.03,.03,.035]]});u.box($,[s+.2,.07,.1],{at:[0,.035,-p-.05],faces:{ny:!1}});for(let e of[-1,1])u.box($,[.1,.07,d+.2],{at:[e*(f+.05),.035,0],faces:{ny:!1}});if(u.box($,[s,.05,.08],{at:[0,.025,p+.04],faces:{ny:!1}}),l){let e=.95,t=[[-f-.05,-p-.05],[f+.05,-p-.05],[-f-.05,p+.02],[f+.05,p+.02]];for(let[n,r]of t)u.box($,[.1,e,.1],{at:[n,e/2,r],rotUV:!0,faces:{ny:!1}}),u.box($,[.14,.05,.14],{at:[n,.975,r]});u.box($,[s+.1,.06,.07],{at:[0,.8999999999999999,-p-.05]}),u.box($,[s+.1,.04,.05],{at:[0,e*.5,-p-.05]});for(let t of[-1,1])u.box($,[.07,.06,d+.07],{at:[t*(f+.05),.8999999999999999,-.015]}),u.box($,[.05,.04,d+.07],{at:[t*(f+.05),e*.5,-.015]})}let _=e.finish(u,`staircase`,t,n,r,i.rotation??0);return e.result(_,{colliders:e.boxColliders(_,-f-.1,f+.1,-p-.1,p)})}function fc(e,t,n,r,i={}){let a=e.rng(`wardrobe`,t,r,i.seed),o=i.kind===`drawers`,s=Ks(i.width,o?1.2:1.4,.6,2.6),c=o?.5:.6,l=o?1:2.2,u=s/2,d=c/2,f=e.builder(Gs(.5)),p=[.84,.8,.78];if(f.box($,[s,.1,c],{at:[0,.05,0],faces:{ny:!1}}),f.box(Ws,[s-.04,l-.18,c-.04],{at:[0,.1+(l-.18)/2,-.02],rotUV:!0,faces:{ny:!1,py:!1}}),f.box($,[s+.1,.08,c+.06],{at:[0,l-.04,.01]}),o){let e=(l-.22)/3;for(let t=0;t<3;t++){let n=.12+e*(t+.5),r=t===2?2:1;for(let t=0;t<r;t++){let i=(s-.1)/r-(r>1?.02:0),a=r===1?0:(t-.5)*(i+.02);f.box(Ws,[i,e-.04,.035],{at:[a,n,d-.01],faces:{ny:!1}}),f.box($,[i,.025,.01],{at:[a,n-e/2+.02,d+.005]});for(let e of r===1?[-i*.28,i*.28]:[0])f.box(`metal`,[.06,.035,.04],{at:[a+e,n,d+.025]})}}let t=l;a.chance(.5)?nc(f,-u*.5,t,0):ec(f,-u*.5,t,0),f.box(`linen`,[.34,.06,.26],{at:[u*.35,t+.03,.02],rot:a.range(-.2,.2)}),f.box(`linen`,[.3,.05,.24],{at:[u*.35,t+.085,.02],rot:a.range(-.2,.2),color:[.6,.72,1]})}else{f.box($,[s+.03,.06,c+.02],{at:[0,l-.11,0]});let e=(s-.14)/2,t=l-.42,n=.16;for(let r of[-1,1]){let i=r*(e/2+.015);f.box(Ws,[e-.02,t,.03],{at:[i,n+t/2,d-.025],rotUV:!0,faces:{ny:!1}});for(let r of[.19,n+t-.03,n+t*.5])f.box($,[e-.02,.06,.02],{at:[i,r,d-.005]});for(let r of[-1,1])f.box($,[.06,t,.02],{at:[i+r*(e/2-.04),n+t/2,d-.005]});for(let r of[n+t*.27,n+t*.73])f.box(Ws,[e-.2,t*.38,.015],{at:[i,r,d-.003],rotUV:!0,color:p});f.box(`metal`,[.04,.06,.04],{at:[r*.06,n+t*.5,d+.02]})}}let m=e.finish(f,o?`drawers`:`wardrobe`,t,n,r,i.rotation??0);return e.result(m,{colliders:e.boxColliders(m,-u-.04,u+.04,-d,d+.04)})}var pc=Object.freeze({daylight:{color:14478591,day:1.15,night:.03,beam:.32,beamColor:16773848},warm:{color:16760944,day:.95,night:1.1,beam:.36,beamColor:16763011}});function mc(e,t,n,r,i={}){let a=Math.round(Ks(i.panes,1,1,3)),o=Ks(i.sill,.9,.3,2),s=pc[qs([`daylight`,`warm`],i.glow,`daylight`)],c=qs([`red`,`linen`,`none`],i.curtains,`red`),l=a,u=1.5,d=l/2,f=o+u,p=e.builder(),m=e.textures.material(`window_inside`,{vertexColors:!0,emissiveIntensity:0,emissive:new G(s.color)});p.quad(m,[[-d,o,.012],[d,o,.012],[d,f,.012],[-d,f,.012]],[[0,0],[a,0],[a,1],[0,1]]);for(let e of[-1,1])p.box($,[.12,1.62,.1],{at:[e*(d+.06),o+u/2+.02,.05],rotUV:!0,faces:{nz:!1}});if(p.box($,[l+.4,.16,.14],{at:[0,f+.08,.07],faces:{nz:!1}}),p.box($,[l+.44,.07,.26],{at:[0,o-.035,.13],faces:{nz:!1}}),p.box($,[l+.2,.14,.04],{at:[0,o-.14,.02],faces:{nz:!1}}),i.flowers===!0&&qo(p,0,o,.25,Math.min(l*.8,l-.1),.2,.3),c!==`none`){let e=c===`red`?`cloth_red`:`linen`,t=c===`red`?[1,1,1]:[1,.97,.9];p.box(`metal`,[l+.9,.035,.035],{at:[0,f+.26,.2]});for(let e of[-1,1])p.box(`metal`,[.06,.06,.06],{at:[e*(d+.47),f+.26,.2]});let n=o-.25,r=f+.24;for(let i of[-1,1]){for(let[a,o,s]of[[.16,.2,.18],[.32,.17,.16]])p.box(e,[s,r-n,.035],{at:[i*(d+a),(n+r)/2,o],faces:{nz:!1},off:[a*3,0],color:t});p.box(e,[.36,.06,.07],{at:[i*(d+.24),o+.35,.19],color:[.75,.62,.45]})}}let h=[{material:m,day:s.day,night:s.night}];if(i.beam!==!1){let t=e.textures.material(`light_beam`,{vertexColors:!0,color:0,emissive:new G(s.beamColor),emissiveIntensity:0,transparent:!0,depthWrite:!1,blending:2,userData:{castShadow:!1,receiveShadow:!1}}),n=f*1,r=o*1,i=.02,a=(e,n)=>p.quad(t,[[-d,i,n],[d,i,n],[d,e,.03],[-d,e,.03]],[[0,.25],[1,.25],[1,1],[0,1]]);a(f-.05,n),a(o+.05,r),p.quad(t,[[-d,i,n],[d,i,n],[d,i,r],[-d,i,r]],[[0,0],[1,0],[1,.25],[0,.25]]),h.push({material:t,day:s.beam,night:0})}let g=e.finish(p,`wallWindow`,t,n,r,i.rotation??0);return e.result(g,{colliders:[],emissives:h})}function hc(e,t,n,r,i={}){let a=e.rng(`sacks`,t,r,i.seed),o=Math.round(Ks(i.count,3,1,4)),s=Math.min(o,3),c=e.builder(Gs(.5)),l=e=>{let t=Array.from({length:10},()=>a.range(.95,1.04));c.lathe(`burlap`,[{y:0,r:.2},{y:.06,r:.26},{y:.3,r:.28},{y:.52,r:.24},{y:.62,r:.14},{y:.67,r:.07}],{segments:10,smooth:!0,uRepeat:2,phase:a.range(0,1),radiusFn:(n,r)=>e&&n>0&&n<4?t[r]:1}),c.tube(`rope`,[0,.65,0],[0,.71,0],.06,.06,{segments:6}),c.lathe(`burlap`,[{y:.7,r:.04},{y:.78,r:.09},{y:.8,r:.05}],{segments:7,smooth:!0,uRepeat:1})};for(let e=0;e<s;e++){let t=(e-(s-1)/2)*.52+a.range(-.03,.03);c.push([t,0,a.range(-.04,.04)],a.range(-.5,.5),[1,a.range(.92,1.05),.72]),l(!0),c.pop()}o>=4&&(c.push([a.range(-.08,.08),.7,.02],[0,a.range(-.25,.25),Math.PI/2-.05],[.8,1,.75]),c.push([0,-.38,0]),l(!1),c.pop(),c.pop());let u=e.finish(c,`sacks`,t,n,r,i.rotation??0),d=(s*.52+.1)/2;return e.result(u,{colliders:e.boxColliders(u,-d,d,-.33,.33)})}var gc=new p,_c=new ge,vc=new ge;function yc(e){let t=null;for(let n of e??[])n.type===`box`&&(t?(t.minX=Math.min(t.minX,n.minX),t.maxX=Math.max(t.maxX,n.maxX),t.minZ=Math.min(t.minZ,n.minZ),t.maxZ=Math.max(t.maxZ,n.maxZ)):t={minX:n.minX,maxX:n.maxX,minZ:n.minZ,maxZ:n.maxZ});return t}var bc=class{constructor({textures:e,seed:t=42}={}){if(!e)throw Error("PropFactory: `textures` (TextureLibrary) is required");this.textures=e,this.seed=t>>>0,this.extra=new Po(this.seed^24301),this._geometries=new Set,this._materials=new Map,this._flameMaterials=new Set,this._ownMaterials=new Set}house(e,t,n,{width:r=4,depth:i=3,stories:a=1,roof:o=`roof_red`,wall:s=`timber_frame`,rotation:c=0,chimney:l=!0,door:u=`front`,...d}={}){return Zo(this,e,t,n,{width:r,depth:i,stories:a,roof:o,wall:s,rotation:c,chimney:l,door:u,...d})}tree(e,t,n,{kind:r=`oak`,height:i=4.5,seed:a,...o}={}){return os(this,e,t,n,{kind:r,height:i,seed:a,...o})}lamppost(e,t,n,r={}){return us(this,e,t,n,r)}wallTorch(e,t,n,r={}){return ds(this,e,t,n,r)}campfire(e,t,n,r={}){return fs(this,e,t,n,r)}fence(e,t,n,r,i,a={}){return xs(this,e,t,n,r,i,a)}well(e,t,n,r={}){return hs(this,e,t,n,r)}marketStall(e,t,n,{cloth:r=`cloth_stripe`,rotation:i,...a}={}){return gs(this,e,t,n,{cloth:r,rotation:i,...a})}barrel(e,t,n,r={}){return Cs(this,e,t,n,r)}crate(e,t,n,r={}){return ws(this,e,t,n,r)}crateStack(e,t,n,r={}){return Ts(this,e,t,n,r)}bridge(e,t,n,r,i,{width:a=2,...o}={}){return vs(this,e,t,n,r,i,{width:a,...o})}signpost(e,t,n,r={}){return Es(this,e,t,n,r)}rock(e,t,n,{size:r=1,...i}={}){return As(this,e,t,n,{size:r,...i})}bench(e,t,n,r={}){return js(this,e,t,n,r)}windmill(e,t,n,r={}){return ys(this,e,t,n,r)}haystack(e,t,n,r={}){return Ms(this,e,t,n,r)}flowerbox(e,t,n,r={}){return Ns(this,e,t,n,r)}chest(e,t,n,r={}){return Vs(this,e,t,n,r)}waystone(e,t,n,r={}){return Hs(this,e,t,n,r)}bed(e,t,n,r={}){return rc(this,e,t,n,r)}table(e,t,n,r={}){return ic(this,e,t,n,r)}chair(e,t,n,r={}){return ac(this,e,t,n,r)}shelf(e,t,n,r={}){return oc(this,e,t,n,r)}hearth(e,t,n,r={}){return cc(this,e,t,n,r)}counter(e,t,n,r={}){return lc(this,e,t,n,r)}rug(e,t,n,r={}){return uc(this,e,t,n,r)}staircase(e,t,n,r={}){return dc(this,e,t,n,r)}wardrobe(e,t,n,r={}){return fc(this,e,t,n,r)}wallWindow(e,t,n,r={}){return mc(this,e,t,n,r)}sacks(e,t,n,r={}){return hc(this,e,t,n,r)}dispose(){for(let e of this._geometries)e.dispose();this._geometries.clear();for(let e of this._materials.values())e.userData.depthMaterial?.dispose(),e.dispose();this._materials.clear();for(let e of this._flameMaterials)e.dispose();this._flameMaterials.clear();for(let e of this._ownMaterials)e.dispose();this._ownMaterials.clear(),this.extra.dispose()}mergeStatic(e,t={}){return ki(this.mergeStaticSteps(e,t))}*mergeStaticSteps(e,{name:t=`props:static`,maxTriangles:n=1/0,maxExtent:r=1/0,minTriangles:i=0,shadowCasters:a=null,tags:o=null}={}){let s=new Map,c=[],l=[],d=!!o?.size,f=(e,t)=>{if(!e.userData.dynamic){t(e);for(let n of e.children)f(n,t)}};for(let t of e){let e=t?.object??t;if(!e?.isObject3D)continue;let n=d?o.get(t)??null:null;e.updateWorldMatrix(!0,!0);let r=e.parent?_c.copy(e.parent.matrixWorld).invert():null;f(e,e=>{if(!e.isMesh||!this._geometries.has(e.geometry))return;let t=e.material;if(Array.isArray(t)||t.isShaderMaterial||t.userData.wind||(vc.copy(e.matrixWorld),r&&vc.premultiply(r),vc.determinant()<0))return;let i=`${t.uuid}|${+e.castShadow}|${+e.receiveShadow}`,a=s.get(i);a||(a={material:t,castShadow:e.castShadow,receiveShadow:e.receiveShadow,depth:e.customDepthMaterial,geos:[],meshes:[],pos:[],tags:[]},s.set(i,a)),a.geos.push(e.geometry.clone().applyMatrix4(vc)),a.meshes.push(e),a.pos.push([vc.elements[12],vc.elements[14]]),a.tags.push(n)}),yield}let p=new u;p.name=t;let m=null;if(a){let e=[];for(let t of s.values()){let n=t.material;!t.castShadow||t.depth||n.isShaderMaterial||n.alphaTest>0&&(n.map||n.alphaMap)||n.alphaToCoverage||(t.proxied=!0,t.geos.forEach((r,i)=>e.push({geometry:r,side:n.side,tag:t.tags[i]})))}m=yield*Bo(e,{name:`${t}:shadow`,...a}),p.add(m.object),l.push(...m.ranges)}for(let e of s.values()){let a=e.geos.map((e,t)=>t),o=Number.isFinite(n)||Number.isFinite(r)?Ai(a,{x:t=>e.pos[t][0],z:t=>e.pos[t][1],weight:t=>Ii(e.geos[t]),maxWeight:n,maxExtent:r,minWeight:i}):[a];d&&(o=o.map(t=>Ni(t,t=>e.tags[t])));let s=`${t}:${e.material.userData.texture||e.material.name||`mat`}`,u=!0,f=[],m=[];for(let t=0;t<o.length&&u;t++){let n=Di(o[t].map(t=>e.geos[t]),!1);if(!n){u=!1;break}d&&m.push(...Pi(n,o[t].map(t=>e.geos[t].attributes.position.count),o[t].map(t=>e.tags[t]),[`position`])),n.computeBoundingSphere(),n.computeBoundingBox();let r=new R(n,e.material);r.name=o.length>1?`${s}#${t}`:s,r.castShadow=e.castShadow&&!e.proxied,r.receiveShadow=e.receiveShadow,e.depth&&(r.customDepthMaterial=e.depth),r.matrixAutoUpdate=!1,f.push(r),yield}for(let t of e.geos)t.dispose();if(!u){for(let e of f)e.geometry.dispose();continue}for(let e of f)p.add(e),c.push(e),this._geometries.add(e.geometry);l.push(...m);for(let t of e.meshes)t.removeFromParent(),t.geometry.dispose(),this._geometries.delete(t.geometry)}return{object:p,meshes:c,ranges:l,dispose:()=>{for(let e of c)e.geometry.dispose(),this._geometries.delete(e.geometry);m?.dispose(),p.removeFromParent()}}}rng(e,t,n,r){let i=le(e)^Math.floor(a(Math.round(t*16),Math.round(n*16),this.seed)*4294967296)^(r==null?0:Math.imul((r|0)+2654435769,2246822507));return new m(i>>>0)}builder(e=null){return new so(this.textures,{ao:e})}track(e){for(let t of e)this._geometries.add(t)}finish(e,t,n,r,i,a=0){let{group:o,geometries:s}=e.build(t);return this.track(s),o.position.set(n,r,i),o.rotation.y=a,o.updateMatrixWorld(!0),o.userData.geometries=s,o}world(e,t){return new p().copy(t).applyMatrix4(e.matrixWorld)}boxCollider(e,t,n,r,i){return{type:`box`,...this.localRect(e,t,n,r,i)}}boxColliders(e,t,n,r,i,a=.25){return this.localRects(e,t,n,r,i,a).map(e=>({type:`box`,...e}))}localRects(e,t,n,r,i,a=.25){let o=[[t,r],[n,r],[n,i],[t,i]].map(([t,n])=>(gc.set(t,0,n).applyMatrix4(e.matrixWorld),[gc.x,gc.z])),s=Math.abs(o[1][0]-o[0][0]),c=Math.abs(o[1][1]-o[0][1]);if(Math.min(s,c)<=1e-6*Math.max(s,c,1e-9))return[this.localRect(e,t,n,r,i)];let l=Math.min(...o.map(e=>e[0])),u=Math.max(...o.map(e=>e[0])),d=Math.max(1,Math.ceil((u-l)/a-1e-9)),f=[];for(let e=0;e<d;e++){let t=l+(u-l)*e/d,n=e===d-1?u:l+(u-l)*(e+1)/d,r=1/0,i=-1/0;for(let e=0;e<4;e++){let[a,s]=o[e],[c,l]=o[(e+1)%4];a>=t&&a<=n&&(r=Math.min(r,s),i=Math.max(i,s));for(let e of[t,n]){if((a-e)*(c-e)>=0)continue;let t=s+(l-s)*(e-a)/(c-a);r=Math.min(r,t),i=Math.max(i,t)}}r<=i&&f.push({minX:t,maxX:n,minZ:r,maxZ:i})}return f}localRect(e,t,n,r,i){let a=1/0,o=-1/0,s=1/0,c=-1/0;for(let[l,u]of[[t,r],[n,r],[n,i],[t,i]])gc.set(l,0,u).applyMatrix4(e.matrixWorld),a=Math.min(a,gc.x),o=Math.max(o,gc.x),s=Math.min(s,gc.z),c=Math.max(c,gc.z);return{minX:a,maxX:o,minZ:s,maxZ:c}}result(e,t={}){let n={object:e,colliders:t.colliders??[],lights:t.lights??[],emissives:xc(t.emissives??[]),emitters:t.emitters??[],...t};n.emissives=xc(n.emissives);let r=t.flames??[];delete n.flames;let i=t.materials??[];delete n.materials;for(let e of i)this._ownMaterials.add(e);return n.dispose=()=>{e.traverse(e=>{e.geometry&&this._geometries.has(e.geometry)&&(e.geometry.dispose(),this._geometries.delete(e.geometry))});for(let e of r)for(let t of e.materials)t.dispose(),this._flameMaterials.delete(t);for(let e of i)e.dispose(),this._ownMaterials.delete(e);e.removeFromParent()},n}flame(e){let t=wo(e);this.track(t.geometries);for(let e of t.materials)this._flameMaterials.add(e);return t}windowMaterial(){return this.textures.material(`window`,{vertexColors:!0,emissiveIntensity:0})}glassMaterial(){return this.textures.material(`lantern_glass`,{vertexColors:!0,emissiveIntensity:0})}windMaterial(e){return this._cachedMaterial(`wind:${e}`,()=>{let t=this._source(e),n=new Be({map:t.map,normalMap:t.normalMap,normalScale:t.normalScale.clone(),vertexColors:!0});return n.name=`luminati:wind:${e}`,n.userData.units=t.units,mo(n,{foliage:!1})})}foliageMaterial(e,{billboard:t=!1}={}){return this._cachedMaterial(`foliage:${e}:${t}`,()=>{let n=this._source(e),r=new Be({map:n.map,normalMap:n.normalMap,normalScale:n.normalScale.clone().multiplyScalar(.8),vertexColors:!0,alphaTest:.5,side:2});return r.name=`luminati:foliage:${e}`,r.userData.units=n.units,mo(r,{foliage:!0,wrap:.5,billboard:t})})}decalMaterial(e){return this._cachedMaterial(`decal:${e}`,()=>{let t=this.extra.textures(e),n=new Be({map:t.map,normalMap:t.normal,vertexColors:!0,alphaTest:.5,side:2,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2});return n.name=`luminati:decal:${e}`,n.userData.units=t.units,n.userData.castShadow=!1,n})}rockGeom(e,t,n,r,i,a,o){return ks(e,t,n,r,i,a,o)}_cachedMaterial(e,t){let n=this._materials.get(e);return n||(n=t(),this._materials.set(e,n)),n}_source(e){if(this.textures.has(e)){let t=this.textures.material(e);return{map:t.map,normalMap:t.normalMap,normalScale:t.normalScale,units:this.textures.meta(e).units}}let t=this.extra.textures(e);return{map:t.map,normalMap:t.normal,normalScale:new F(.6,.6),units:t.units}}};function xc(e){let t=new Set,n=[];for(let r of e)t.has(r.material)||(t.add(r.material),n.push(r));return n}var Sc=Object.freeze({distance:30,pitch:32,fov:28,minDistance:18,maxDistance:42}),Cc=1/90,wc=Object.freeze({noon:12.6,lat:32,dec:14,refTime:17.2,refAzimuth:-112}),Tc=Object.freeze({refAzimuth:40}),Ec=Object.freeze({night:{hemiI:1.6,hemiSky:`#3656c0`,hemiGround:`#1a2042`,sunI:1,exp:1.36},"late night":{hemiI:1.55,hemiSky:`#3656c0`,hemiGround:`#1a2042`,sunI:.9,exp:1.36},"blue hour":{hemiI:1.5,exp:1.36},sunset:{hemiI:1.45,exp:1.2},"purple dusk":{sunI:.85,hemiI:1.62,exp:1.46},"golden hour":{hemiGround:`#7a6058`,hemiSky:`#6a80d4`}}),Dc=Object.freeze({normalUp:.6,wrap:.6,roundness:.55,emissive:`#ffe9d2`,emissiveIntensity:.06}),Oc=Object.freeze({day:.05,night:.03}),kc=Object.freeze([.5,.62]);export{Q as A,Ni as C,Ii as D,Pi as E,dt as M,Z as N,ki as O,Ei as P,Li as S,ji as T,za as _,Tc as a,Aa as b,Cc as c,zo as d,Fo as f,Bo as g,Uo as h,Ec as i,X as j,Di as k,bc as l,Io as m,Dc as n,Oc as o,Lo as p,kc as r,wc as s,Sc as t,yc as u,Ka as v,Ai as w,Fi as x,Ga as y};