import{g as S,p as P}from"./idb-DMf-W6wC.js";const T=new TextEncoder,v="https://api.looptloop.online/v0",j="WITNESSKEY_AUTHORIZATION_ACCEPTANCE_0_1";function i(e){return!!(e&&typeof e=="object"&&!Array.isArray(e))}function E(e,a){let t=e;for(const n of a){if(!i(t))return;t=t[n]}return t}function _(e,a){for(const t of a){const n=E(e,t);if(n!=null)return n}}function r(e,a){const t=_(e,a);return typeof t=="string"&&t.trim().length>0?t:void 0}function b(e){if(typeof e=="string"){const a=e.trim();return a.length>0?a:void 0}if(typeof e=="number"||typeof e=="boolean")return String(e);if(i(e)){for(const a of["label","text","claim","name","title","value","description"]){const t=e[a];if(typeof t=="string"&&t.trim().length>0)return t}return JSON.stringify(e)}}function h(e,a){const t=_(e,a);if(t==null)return[];if(Array.isArray(t))return t.map(s=>b(s)).filter(s=>!!s);const n=b(t);return n?[n]:[]}function N(e,a){const t={...e};for(const[n,s]of Object.entries(a))s!==void 0&&(t[n]=s);return t}function R(e){if(!i(e))return{};for(const a of["authorization_offer","offer","data"]){const t=e[a];if(i(t))return R(t)}return e}function k(e){return Array.from(e,a=>a.toString(16).padStart(2,"0")).join("")}function C(e){return typeof e=="string"&&/^sha256:[0-9a-f]{64}$/i.test(e)}async function L(e){const a=await crypto.subtle.digest("SHA-256",T.encode(e));return k(new Uint8Array(a))}async function z(e){if(C(e.consentPromptHash))return e.consentPromptHash;if(e.consentPrompt)return`sha256:${await L(e.consentPrompt)}`}function x(e,a){const t=R(e),n=i(t.issuer)?t.issuer:{},s=i(t.payload)?t.payload:{};return N({offerId:r(t,[["offer_id"],["id"],["authorization_offer_id"]])??a,declaredRoles:h(t,[["declared_roles"],["roles"],["participant_roles"]]),claims:h(t,[["claims"],["claims_to_make"]]),nonClaims:h(t,[["non_claims"],["nonClaims"],["claims_not_made"]]),raw:t},{issuerName:r(t,[["issuer_name"]])??r(n,[["name"],["display_name"]]),issuerOrigin:r(t,[["issuer_origin"]])??r(n,[["origin"],["url"]]),eventType:r(t,[["event_type"],["authorization_event_type"],["event","type"]]),payloadHash:r(t,[["payload_hash"]])??r(s,[["hash"]]),payloadLabel:r(t,[["payload_label"]])??r(s,[["label"]]),consentPrompt:r(t,[["consent_prompt"],["consent","prompt"],["prompt"]]),storagePolicy:r(t,[["storage_policy"],["storage","policy"],["storage_policy_text"]]),notStoredPolicy:r(t,[["not_stored_policy"],["privacy","not_stored_policy"],["notStoredPolicy"]]),expiresAt:r(t,[["expires_at"],["expiresAt"],["expiration_time"]]),returnUrl:r(t,[["return_url"],["returnUrl"]]),consentPromptHash:r(t,[["consent_prompt_hash"],["consent","prompt_hash"]])})}async function H(e){const a=await e.text();if(!a)return{};try{return JSON.parse(a)}catch{return{message:a}}}async function g(e,a){const t=await H(e);if(e.ok)return t;const n=i(t)&&i(t.error)?t.error:null,s=n&&typeof n.code=="string"?n.code:void 0,c=n&&typeof n.message=="string"?n.message:void 0,d=s&&c&&`${s}: ${c}`||c||s||i(t)&&typeof t.error=="string"&&t.error||i(t)&&typeof t.message=="string"&&t.message||`${a} (${e.status})`;throw new Error(d)}async function U(e,a={}){const t=a.apiBase??v,s=await(a.fetchImpl??fetch)(`${t}/authorization-offers/${encodeURIComponent(e)}`,{method:"GET",headers:{Accept:"application/json"}});return x(await g(s,"Failed to load authorization offer"),e)}async function B(e,a){const t=await z(e);if(!t)throw new Error("missing_consent_prompt_hash: Offer did not include a valid consent prompt hash and Abracadoo could not derive one locally.");return{schema:j,accepted_by:{app:"abracadoo.app",participant_ref:a,participant_role:"human_authorizer"},consent_action:"accept",consent_prompt_hash:t}}async function W(e,a,t={}){const n=t.apiBase??v,s=t.fetchImpl??fetch,c=await B(e,a),d=await s(`${n}/authorization-offers/${encodeURIComponent(e.offerId)}/accept`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(c)});return{payload:c,response:await g(d,"Failed to accept witness offer")}}async function D(e,a={}){const t=a.apiBase??v,n=a.fetchImpl??fetch,s={app:"abracadoo.app",consent_action:"reject"},c=await n(`${t}/authorization-offers/${encodeURIComponent(e)}/reject`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(s)});return g(c,"Failed to reject witness offer")}const A="abracadoo.acceptWitness.participantRef.v1";function M(e){return`abracadoo.local.participant/${e}`}function J(e=window.localStorage,a=()=>crypto.randomUUID()){const t=e.getItem(A);if(t&&t.trim().length>0)return t;const n=M(a());return e.setItem(A,n),n}function $(e){return`witness-receipt:${e}`}function q(e){const a={};for(const[t,n]of Object.entries(e))n!==void 0&&(a[t]=n);return a}async function F(e){return S("witnessReceipts",$(e))}async function K(e){const a={id:$(e.offer.offerId),offerId:e.offer.offerId,participantRef:e.participantRef,storedAt:e.storedAt??new Date().toISOString(),offerSummary:q({issuerName:e.offer.issuerName,issuerOrigin:e.offer.issuerOrigin,eventType:e.offer.eventType,payloadHash:e.offer.payloadHash,payloadLabel:e.offer.payloadLabel}),receipt:e.receipt,...e.offer.returnUrl?{returnUrl:e.offer.returnUrl}:{}};return await P("witnessReceipts",a),a}function p(e){const a=document.querySelector(e);if(!a)throw new Error(`Missing element: ${e}`);return a}function o(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function I(e){if(!e)return"Not provided";const a=new Date(e);return Number.isNaN(a.getTime())?e:new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(a)}function Y(e){return e&&e.trim().length>0?o(e):'<span class="accept-empty">Not provided</span>'}function y(e){return e.length===0?'<p class="accept-empty">Not provided</p>':`<ul>${e.map(a=>`<li>${o(a)}</li>`).join("")}</ul>`}function Z(e,a="/"){if(!e)return a;try{const t=new URL(e,window.location.origin);if(t.protocol==="http:"||t.protocol==="https:")return t.toString()}catch{return a}return a}function w(e,a="/"){return Z(e.returnUrl,a)}function l(e,a){return`<div><dt>${o(e)}</dt><dd>${Y(a)}</dd></div>`}function G(e){return e?`
    <p class="accept-note">
      A local witness receipt for this offer is already stored from ${o(I(e.storedAt))}.
      Accepting again may create a second server-side event even though Abracadoo already has a local copy.
    </p>
  `:""}function X(e){return o(JSON.stringify(e,null,2))}function Q(e,a,t){const n={"Offer ID":a.offerId,"Participant ref":t,"Event type":a.eventType??"Not provided"};if(e&&typeof e=="object"&&!Array.isArray(e))for(const[s,c]of[["Receipt ID","receipt_id"],["Authorization ID","authorization_id"],["Event ID","event_id"],["Witness Event ID","witness_event_id"],["Accepted at","accepted_at"],["Witnessed at","witnessed_at"],["Status","status"]]){const d=e[c];typeof d=="string"&&d.trim().length>0&&(n[s]=d)}return n}function V(e){return`<dl class="accept-facts">${Object.entries(e).map(([a,t])=>l(a,t)).join("")}</dl>`}function ee(e,a){const t=p("#accept-witness-root");t.innerHTML=`
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness acceptance</span>
          </div>
        </div>
        <a class="pill accept-link" href="/">Open main app</a>
      </header>

      <section class="accept-hero panel">
        <div>
          <p class="eyebrow">WitnessKey / LOOPtLOOP</p>
          <h1>Review witness authorization offer</h1>
          <p class="accept-help">Review what is being requested before you explicitly accept or reject this witness loop.</p>
        </div>
        <div class="accept-chip-row">
          <span class="pill">${o(e.eventType??"event type pending")}</span>
          <span class="pill">${o(e.offerId)}</span>
        </div>
        <p class="accept-note">This creates a witnessed authorization event. It does not automatically create a Relationship.</p>
        ${G(a)}
      </section>

      <section class="accept-layout">
        <div class="accept-panel">
          <section class="panel accept-summary">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Offer</p>
                <h2>Offer summary</h2>
              </div>
            </div>
            <dl class="accept-facts">
              ${l("Issuer name",e.issuerName)}
              ${l("Issuer origin",e.issuerOrigin)}
              ${l("Event type",e.eventType)}
              ${l("Payload hash",e.payloadHash)}
              ${l("Payload label",e.payloadLabel)}
              ${l("Consent prompt",e.consentPrompt)}
              ${l("Expiration time",e.expiresAt?I(e.expiresAt):void 0)}
            </dl>
          </section>

          <section class="panel accept-list">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Roles</p>
                <h3>Declared roles</h3>
              </div>
            </div>
            ${y(e.declaredRoles)}
          </section>

          <section class="panel accept-policy">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Policies</p>
                <h3>Storage policy</h3>
              </div>
            </div>
            ${e.storagePolicy?`<p>${o(e.storagePolicy)}</p>`:'<p class="accept-empty">Not provided</p>'}
            <h3>Not-stored policy</h3>
            ${e.notStoredPolicy?`<p>${o(e.notStoredPolicy)}</p>`:'<p class="accept-empty">Not provided</p>'}
          </section>

          <section class="panel accept-list">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Claims</p>
                <h3>Claims</h3>
              </div>
            </div>
            ${y(e.claims)}
            <h3>Non-claims</h3>
            ${y(e.nonClaims)}
          </section>
        </div>

        <aside class="panel accept-sidecard">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Actions</p>
              <h2>Decide locally</h2>
            </div>
          </div>
          <p class="accept-help">Abracadoo will send only acceptance metadata. It will not send any private authorization payload.</p>
          <div class="accept-action-row">
            <button id="accept-offer" type="button">Accept witness loop</button>
            <button id="reject-offer" type="button" class="button-danger">Reject</button>
            <a id="cancel-offer" class="button-secondary accept-link" href="${o(w(e))}">Cancel / leave</a>
          </div>
          <p id="accept-status" class="accept-status" aria-live="polite"></p>
          <div class="accept-meta">
            <span class="pill">${o(e.returnUrl?"return URL available":"no return URL")}</span>
            <span class="pill">participant role: human_authorizer</span>
          </div>
        </aside>
      </section>
    </main>
  `}function te(e,a,t){const n=p("#accept-witness-root"),s=Q(t,e,a);n.innerHTML=`
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness receipt stored</span>
          </div>
        </div>
        <a class="pill accept-link" href="/">Open main app</a>
      </header>

      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Accepted</p>
          <h1>Witness authorization accepted</h1>
          <p class="accept-help">Abracadoo stored the returned receipt locally as a witness artifact.</p>
        </div>
        <p class="accept-note">This creates a witnessed authorization event. It does not automatically create a Relationship.</p>
      </section>

      <section class="accept-layout">
        <div class="accept-panel">
          <section class="panel accept-summary">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Receipt</p>
                <h2>Receipt summary</h2>
              </div>
            </div>
            ${V(s)}
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Raw receipt</p>
                <h2>Returned receipt data</h2>
              </div>
            </div>
            <pre class="accept-json">${X(t)}</pre>
          </section>
        </div>

        <aside class="panel accept-sidecard">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Next</p>
              <h2>Return or leave</h2>
            </div>
          </div>
          <p class="accept-help">The witness receipt is stored locally. No private authorization payload was transmitted by Abracadoo.</p>
          <div class="accept-action-row">
            <a class="accept-link" href="${o(w(e))}">Return to WitnessMark</a>
          </div>
          <a class="accept-footer-link" href="/">Back to Abracadoo</a>
        </aside>
      </section>
    </main>
  `}function ae(e){const a=p("#accept-witness-root");a.innerHTML=`
    <main class="app-shell accept-shell">
      <header class="app-header" aria-label="Abracadoo witness header">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true">
            <img src="/spiral.png" alt="" width="28" height="28" />
          </span>
          <div class="brand-text">
            <strong>Abracadoo</strong>
            <span>Witness offer rejected</span>
          </div>
        </div>
      </header>

      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Rejected</p>
          <h1>Witness authorization rejected</h1>
          <p class="accept-help">No witness receipt was stored locally.</p>
        </div>
        <p class="accept-note">This creates a witnessed authorization event only when accepted. It does not automatically create a Relationship.</p>
        <div class="accept-action-row">
          <a class="accept-link" href="${o(w(e))}">Return to WitnessMark</a>
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `}function O(e){const a=p("#accept-witness-root");a.innerHTML=`
    <main class="app-shell accept-shell">
      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Witness acceptance</p>
          <h1>Unable to continue</h1>
          <p class="accept-error">${o(e)}</p>
        </div>
        <div class="accept-action-row">
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `}function m(e){return e instanceof Error?e.message:String(e)}function f(e,a=!1){const t=p("#accept-status");t.textContent=e,t.classList.toggle("accept-error",a)}function u(e){const a=p("#accept-offer"),t=p("#reject-offer");a.disabled=e,t.disabled=e}async function ne(e){const a=J();p("#accept-offer").addEventListener("click",async()=>{try{u(!0),f("Accepting witness offer...");const t=await W(e,a);await K({offer:e,participantRef:a,receipt:t.response}),te(e,a,t.response)}catch(t){f(`Accept failed. ${m(t)}`,!0)}finally{document.querySelector("#accept-offer")&&u(!1)}}),p("#reject-offer").addEventListener("click",async()=>{try{u(!0),f("Rejecting witness offer..."),await D(e.offerId),ae(e)}catch(t){f(`Reject failed. ${m(t)}`,!0),u(!1)}})}async function se(){const e=new URLSearchParams(window.location.search).get("offer_id");if(!e){O("Missing offer_id in the query string.");return}const a=await F(e),t=await U(e);ee(t,a),await ne(t)}se().catch(e=>{console.error(e),O(m(e))});
