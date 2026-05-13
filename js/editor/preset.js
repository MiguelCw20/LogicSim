const gateList = document.getElementById('porta-logicas-listas');

if (gateList) {
    gateList.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-gate]');
        if (!link) {
            return;
        }

        const gateType = link.dataset.gate;
        if (gateType) {
            localStorage.setItem('selectedGate', gateType);
        }
    });
}
