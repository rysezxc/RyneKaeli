const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxBcciG6o5oMi1pTodBsJb-kKS8EDIVAQrYhLjC8_DOPXz6VSTNLUV1RRRJ51SumzcAvQ/exec';

// ─── RSVP Form ───────────────────────────────────────────────────────────────
const rsvpForm    = document.getElementById('rsvpForm');
const rsvpContent = document.getElementById('rsvpContent');
const thankYou    = document.getElementById('thankYou');

// Cache of all submitted names (fetched on load for duplicate checking)
let submittedNames = [];

function fetchSubmittedNames() {
    fetch(APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            submittedNames = (data.guests || []).map(g => g.name.trim().toLowerCase());
        })
        .catch(() => { submittedNames = []; });
}
fetchSubmittedNames();

// Inline error helper
function setNameError(msg) {
    const nameInput = rsvpForm.querySelector('input[type="text"]');
    let errEl = document.getElementById('nameError');
    if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'nameError';
        errEl.className = 'text-xs text-rose-400 mt-1 tracking-wide';
        nameInput.parentNode.appendChild(errEl);
    }
    errEl.textContent = msg;
    nameInput.classList.toggle('border-rose-300', !!msg);
    nameInput.classList.toggle('border-pink-100',  !msg);
}

// Clear error as user types
const nameInputEl = document.querySelector('#rsvpForm input[type="text"]');
if (nameInputEl) {
    nameInputEl.addEventListener('input', () => setNameError(''));
}

rsvpForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const nameInput      = rsvpForm.querySelector('input[type="text"]');
    const attendingInput = rsvpForm.querySelector('input[name="attending"]:checked');
    const messageInput   = rsvpForm.querySelector('textarea');
    const name           = nameInput ? nameInput.value.trim() : '';

    // ── Duplicate check ──────────────────────────────────────────────────────
    if (submittedNames.includes(name.toLowerCase())) {
        setNameError('This name has already been submitted. Please check your entry.');
        nameInput.focus();
        return;
    }
    setNameError('');

    const entry = {
        name,
        attending: attendingInput ? attendingInput.value      : '',
        message:   messageInput   ? messageInput.value.trim() : '',
        timestamp: new Date().toISOString()
    };

    // Optimistically add to local cache to block double-click re-submit
    submittedNames.push(name.toLowerCase());

    const submitBtn = rsvpForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode:   'no-cors',
        body:   JSON.stringify(entry),
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(() => {
        rsvpContent.classList.add('hidden');
        thankYou.classList.remove('hidden');
        setTimeout(fetchAttendeeCount, 1500);
    })
    .catch(err => {
        console.error('Fetch error:', err);
        // Roll back optimistic cache entry on failure
        submittedNames = submittedNames.filter(n => n !== name.toLowerCase());
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Response';
        alert('Network error: ' + err.message);
    });
});


// ─── Attendee Count ──────────────────────────────────────────────────────────
function fetchAttendeeCount() {
    fetch(APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            const countEl = document.getElementById('attendeeCount');
            const labelEl = document.getElementById('attendeeLabel');
            if (countEl) countEl.textContent = data.attendingYes ?? data.total ?? '—';
            if (labelEl) {
                const n = data.attendingYes ?? 0;
                labelEl.textContent = n === 1 ? 'Guest Attending' : 'Guests Attending';
            }
            // Keep local names cache in sync
            submittedNames = (data.guests || []).map(g => g.name.trim().toLowerCase());
        })
        .catch(() => {
            const countEl = document.getElementById('attendeeCount');
            if (countEl) countEl.textContent = '—';
        });
}
fetchAttendeeCount();


// ─── Attendee Modal ──────────────────────────────────────────────────────────
const modal         = document.getElementById('attendeeModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModal');
const guestList     = document.getElementById('guestList');
const guestEmpty    = document.getElementById('guestEmpty');
const modalLoading  = document.getElementById('modalLoading');
const attendeeCard  = document.getElementById('attendeeCard');

function openModal() {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadGuestList();
}

function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

attendeeCard.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadGuestList() {
    modalLoading.classList.remove('hidden');
    guestList.classList.add('hidden');
    guestEmpty.classList.add('hidden');
    guestList.innerHTML = '';

    fetch(APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(data => {
            modalLoading.classList.add('hidden');
            const guests = (data.guests || []).filter(g => g.attending === 'yes');

            if (guests.length === 0) {
                guestEmpty.classList.remove('hidden');
                return;
            }

            const colors = [
                'bg-pink-100 text-pink-500',
                'bg-rose-100 text-rose-500',
                'bg-fuchsia-100 text-fuchsia-500',
                'bg-purple-100 text-purple-400',
                'bg-orange-100 text-orange-400',
            ];

            guests.forEach((guest, i) => {
                const initials = guest.name
                    ? guest.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
                    : '?';
                const color = colors[i % colors.length];
                const li = document.createElement('li');
                li.className = 'py-4 flex items-center gap-4';
                li.innerHTML = `
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(guest.name)}</p>
                    </div>
                `;
                guestList.appendChild(li);
            });

            guestList.classList.remove('hidden');
        })
        .catch(err => {
            console.error('Could not load guest list:', err);
            modalLoading.classList.add('hidden');
            guestEmpty.classList.remove('hidden');
        });
}


// ─── Countdown Timer ─────────────────────────────────────────────────────────
const targetDate = new Date('March 17, 2026 10:00:00').getTime();

function updateCountdown() {
    const now  = new Date().getTime();
    const diff = targetDate - now;
    if (diff > 0) {
        document.getElementById('days').innerText    = Math.floor(diff / 86400000).toString().padStart(2, '0');
        document.getElementById('hours').innerText   = Math.floor((diff % 86400000) / 3600000).toString().padStart(2, '0');
        document.getElementById('minutes').innerText = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    } else {
        ['days','hours','minutes'].forEach(id => document.getElementById(id).innerText = '00');
    }
}
setInterval(updateCountdown, 1000);
updateCountdown();


// ─── Smooth Scroll ───────────────────────────────────────────────────────────
function smoothScrollTo(targetY, duration = 600) {
    const startY = window.pageYOffset;
    const dist   = targetY - startY;
    let start    = null;
    function step(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const e = p < 0.5 ? 2*p*p : -1 + (4-2*p)*p;
        window.scrollTo(0, startY + dist * e);
        if (ts - start < duration) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

const detailsLink = document.getElementById('detailsLink');
if (detailsLink) {
    detailsLink.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.getElementById('details');
        if (target) smoothScrollTo(target.offsetTop);
        history.pushState(null, '', '#details');
    });
}