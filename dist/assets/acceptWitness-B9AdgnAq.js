import{g as I,p as O}from"./idb-DMf-W6wC.js";const P=new TextEncoder,m="https://api.looptloop.online/v0";function p(e){return!!(e&&typeof e=="object"&&!Array.isArray(e))}function j(e,a){let t=e;for(const n of a){if(!p(t))return;t=t[n]}return t}function A(e,a){for(const t of a){const n=j(e,t);if(n!=null)return n}}function r(e,a){const t=A(e,a);return typeof t=="string"&&t.trim().length>0?t:void 0}function w(e){if(typeof e=="string"){const a=e.trim();return a.length>0?a:void 0}if(typeof e=="number"||typeof e=="boolean")return String(e);if(p(e)){for(const a of["label","text","claim","name","title","value","description"]){const t=e[a];if(typeof t=="string"&&t.trim().length>0)return t}return JSON.stringify(e)}}function h(e,a){const t=A(e,a);if(t==null)return[];if(Array.isArray(t))return t.map(s=>w(s)).filter(s=>!!s);const n=w(t);return n?[n]:[]}function T(e,a){const t={...e};for(const[n,s]of Object.entries(a))s!==void 0&&(t[n]=s);return t}function _(e){if(!p(e))return{};for(const a of["authorization_offer","offer","data"]){const t=e[a];if(p(t))return _(t)}return e}function k(e){let a="";for(const t of e)a+=String.fromCharCode(t);return btoa(a)}async function L(e){const a=await crypto.subtle.digest("SHA-256",P.encode(e));return k(new Uint8Array(a))}async function N(e){if(e.consentPromptHash)return e.consentPromptHash;if(e.consentPrompt)return L(e.consentPrompt)}function z(e,a){const t=_(e),n=p(t.issuer)?t.issuer:{},s=p(t.payload)?t.payload:{};return T({offerId:r(t,[["offer_id"],["id"],["authorization_offer_id"]])??a,declaredRoles:h(t,[["declared_roles"],["roles"],["participant_roles"]]),claims:h(t,[["claims"],["claims_to_make"]]),nonClaims:h(t,[["non_claims"],["nonClaims"],["claims_not_made"]]),raw:t},{issuerName:r(t,[["issuer_name"]])??r(n,[["name"],["display_name"]]),issuerOrigin:r(t,[["issuer_origin"]])??r(n,[["origin"],["url"]]),eventType:r(t,[["event_type"],["authorization_event_type"],["event","type"]]),payloadHash:r(t,[["payload_hash"]])??r(s,[["hash"]]),payloadLabel:r(t,[["payload_label"]])??r(s,[["label"]]),consentPrompt:r(t,[["consent_prompt"],["consent","prompt"],["prompt"]]),storagePolicy:r(t,[["storage_policy"],["storage","policy"],["storage_policy_text"]]),notStoredPolicy:r(t,[["not_stored_policy"],["privacy","not_stored_policy"],["notStoredPolicy"]]),expiresAt:r(t,[["expires_at"],["expiresAt"],["expiration_time"]]),returnUrl:r(t,[["return_url"],["returnUrl"]]),consentPromptHash:r(t,[["consent_prompt_hash"],["consent","prompt_hash"]])})}async function E(e){const a=await e.text();if(!a)return{};try{return JSON.parse(a)}catch{return{message:a}}}async function v(e,a){const t=await E(e);if(e.ok)return t;const n=p(t)&&typeof t.error=="string"&&t.error||p(t)&&typeof t.message=="string"&&t.message||`${a} (${e.status})`;throw new Error(n)}async function x(e,a={}){const t=a.apiBase??m,s=await(a.fetchImpl??fetch)(`${t}/authorization-offers/${encodeURIComponent(e)}`,{method:"GET",headers:{Accept:"application/json"}});return z(await v(s,"Failed to load authorization offer"),e)}async function C(e,a){const t={app:"abracadoo.app",participant_ref:a,participant_role:"human_authorizer",consent_action:"accept"},n=await N(e);return n&&(t.consent_prompt_hash=n),t}async function U(e,a,t={}){const n=t.apiBase??m,s=t.fetchImpl??fetch,l=await C(e,a),d=await s(`${n}/authorization-offers/${encodeURIComponent(e.offerId)}/accept`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(l)});return{payload:l,response:await v(d,"Failed to accept witness offer")}}async function B(e,a={}){const t=a.apiBase??m,n=a.fetchImpl??fetch,s={app:"abracadoo.app",consent_action:"reject"},l=await n(`${t}/authorization-offers/${encodeURIComponent(e)}/reject`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(s)});return v(l,"Failed to reject witness offer")}const b="abracadoo.acceptWitness.participantRef.v1";function H(e){return`abracadoo.local.participant/${e}`}function D(e=window.localStorage,a=()=>crypto.randomUUID()){const t=e.getItem(b);if(t&&t.trim().length>0)return t;const n=H(a());return e.setItem(b,n),n}function R(e){return`witness-receipt:${e}`}function W(e){const a={};for(const[t,n]of Object.entries(e))n!==void 0&&(a[t]=n);return a}async function J(e){return I("witnessReceipts",R(e))}async function M(e){const a={id:R(e.offer.offerId),offerId:e.offer.offerId,participantRef:e.participantRef,storedAt:e.storedAt??new Date().toISOString(),offerSummary:W({issuerName:e.offer.issuerName,issuerOrigin:e.offer.issuerOrigin,eventType:e.offer.eventType,payloadHash:e.offer.payloadHash,payloadLabel:e.offer.payloadLabel}),receipt:e.receipt,...e.offer.returnUrl?{returnUrl:e.offer.returnUrl}:{}};return await O("witnessReceipts",a),a}function i(e){const a=document.querySelector(e);if(!a)throw new Error(`Missing element: ${e}`);return a}function c(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function $(e){if(!e)return"Not provided";const a=new Date(e);return Number.isNaN(a.getTime())?e:new Intl.DateTimeFormat(void 0,{dateStyle:"medium",timeStyle:"short"}).format(a)}function q(e){return e&&e.trim().length>0?c(e):'<span class="accept-empty">Not provided</span>'}function y(e){return e.length===0?'<p class="accept-empty">Not provided</p>':`<ul>${e.map(a=>`<li>${c(a)}</li>`).join("")}</ul>`}function F(e,a="/"){if(!e)return a;try{const t=new URL(e,window.location.origin);if(t.protocol==="http:"||t.protocol==="https:")return t.toString()}catch{return a}return a}function g(e,a="/"){return F(e.returnUrl,a)}function o(e,a){return`<div><dt>${c(e)}</dt><dd>${q(a)}</dd></div>`}function K(e){return e?`
    <p class="accept-note">
      A local witness receipt for this offer is already stored from ${c($(e.storedAt))}.
      Accepting again may create a second server-side event even though Abracadoo already has a local copy.
    </p>
  `:""}function G(e){return c(JSON.stringify(e,null,2))}function X(e,a,t){const n={"Offer ID":a.offerId,"Participant ref":t,"Event type":a.eventType??"Not provided"};if(e&&typeof e=="object"&&!Array.isArray(e))for(const[s,l]of[["Receipt ID","receipt_id"],["Authorization ID","authorization_id"],["Event ID","event_id"],["Witness Event ID","witness_event_id"],["Accepted at","accepted_at"],["Witnessed at","witnessed_at"],["Status","status"]]){const d=e[l];typeof d=="string"&&d.trim().length>0&&(n[s]=d)}return n}function Y(e){return`<dl class="accept-facts">${Object.entries(e).map(([a,t])=>o(a,t)).join("")}</dl>`}function Q(e,a){const t=i("#accept-witness-root");t.innerHTML=`
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
          <span class="pill">${c(e.eventType??"event type pending")}</span>
          <span class="pill">${c(e.offerId)}</span>
        </div>
        <p class="accept-note">This creates a witnessed authorization event. It does not automatically create a Relationship.</p>
        ${K(a)}
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
              ${o("Issuer name",e.issuerName)}
              ${o("Issuer origin",e.issuerOrigin)}
              ${o("Event type",e.eventType)}
              ${o("Payload hash",e.payloadHash)}
              ${o("Payload label",e.payloadLabel)}
              ${o("Consent prompt",e.consentPrompt)}
              ${o("Expiration time",e.expiresAt?$(e.expiresAt):void 0)}
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
            ${e.storagePolicy?`<p>${c(e.storagePolicy)}</p>`:'<p class="accept-empty">Not provided</p>'}
            <h3>Not-stored policy</h3>
            ${e.notStoredPolicy?`<p>${c(e.notStoredPolicy)}</p>`:'<p class="accept-empty">Not provided</p>'}
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
            <a id="cancel-offer" class="button-secondary accept-link" href="${c(g(e))}">Cancel / leave</a>
          </div>
          <p id="accept-status" class="accept-status" aria-live="polite"></p>
          <div class="accept-meta">
            <span class="pill">${c(e.returnUrl?"return URL available":"no return URL")}</span>
            <span class="pill">participant role: human_authorizer</span>
          </div>
        </aside>
      </section>
    </main>
  `}function V(e,a,t){const n=i("#accept-witness-root"),s=X(t,e,a);n.innerHTML=`
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
            ${Y(s)}
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Raw receipt</p>
                <h2>Returned receipt data</h2>
              </div>
            </div>
            <pre class="accept-json">${G(t)}</pre>
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
            <a class="accept-link" href="${c(g(e))}">Return to WitnessMark</a>
          </div>
          <a class="accept-footer-link" href="/">Back to Abracadoo</a>
        </aside>
      </section>
    </main>
  `}function Z(e){const a=i("#accept-witness-root");a.innerHTML=`
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
          <a class="accept-link" href="${c(g(e))}">Return to WitnessMark</a>
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `}function S(e){const a=i("#accept-witness-root");a.innerHTML=`
    <main class="app-shell accept-shell">
      <section class="panel accept-hero">
        <div>
          <p class="eyebrow">Witness acceptance</p>
          <h1>Unable to continue</h1>
          <p class="accept-error">${c(e)}</p>
        </div>
        <div class="accept-action-row">
          <a class="accept-link" href="/">Back to Abracadoo</a>
        </div>
      </section>
    </main>
  `}function f(e,a=!1){const t=i("#accept-status");t.textContent=e,t.classList.toggle("accept-error",a)}function u(e){const a=i("#accept-offer"),t=i("#reject-offer");a.disabled=e,t.disabled=e}async function ee(e){const a=D();i("#accept-offer").addEventListener("click",async()=>{try{u(!0),f("Accepting witness offer...");const t=await U(e,a);await M({offer:e,participantRef:a,receipt:t.response}),V(e,a,t.response)}catch(t){f(t instanceof Error?t.message:String(t),!0)}finally{document.querySelector("#accept-offer")&&u(!1)}}),i("#reject-offer").addEventListener("click",async()=>{try{u(!0),f("Rejecting witness offer..."),await B(e.offerId),Z(e)}catch(t){f(t instanceof Error?t.message:String(t),!0),u(!1)}})}async function te(){const e=new URLSearchParams(window.location.search).get("offer_id");if(!e){S("Missing offer_id in the query string.");return}const a=await J(e),t=await x(e);Q(t,a),await ee(t)}te().catch(e=>{console.error(e),S(e instanceof Error?e.message:String(e))});
