// Konfiguration
const workingHours = { start: 8, end: 14 }; // Arbeitsstunden pro Tag
const days = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
let currentWeekStart = new Date(); // Aktuelles Datum
currentWeekStart.setHours(0, 0, 0, 0); // Zeit auf Mitternacht setzen

// Aktuellen Wochenstart auf Montag setzen
const day = currentWeekStart.getDay() || 7; // Wenn Sonntag (0), dann 7 setzen
currentWeekStart.setDate(currentWeekStart.getDate() - day + 2);

function showLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "flex";
}

function hideLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "none";
}

let availability = {};

async function fetchAvailableSlots(startDate, endDate) {
    showLoadingIndicator();
    try {
        // Füge Standardwerte hinzu, falls Parameter undefined sind
        if (!startDate) {
            startDate = new Date().toISOString();
        }
        if (!endDate) {
            let tempDate = new Date();
            tempDate.setDate(tempDate.getDate() + 7);
            endDate = tempDate.toISOString();
        }

        const response = await fetch(`/available?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`);
        availability = await response.json();
        console.log("API response (Verfügbare Slots):", availability);
    } catch (error) {
        console.error("Fehler beim Abrufen der verfügbaren Slots:", error);
        availability = {};
    } finally {
        hideLoadingIndicator();
    }
}

function createWeekDays() {
    const weekDayContainer = document.getElementById("week-days");
    weekDayContainer.innerHTML = "<div></div>"; // Erste Zelle leer lassen

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(currentWeekStart);
        currentDate.setDate(currentDate.getDate() + i - 1); // Änderung hier
        const cell = document.createElement("div");
        cell.innerHTML = `<p>${days[i]}<br>${currentDate.toLocaleDateString()}</p>`;
        weekDayContainer.appendChild(cell);
    }
}

// Funktion zum Formatieren des Datums für den Schlüssel
function formatDateForKey(date) {
    return date.getUTCFullYear() + '-' +
        String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(date.getUTCDate()).padStart(2, '0') + 'T' +
        String(date.getUTCHours()).padStart(2, '0') + ':' +
        String(date.getUTCMinutes()).padStart(2, '0') + ':' +
        String(date.getUTCSeconds()).padStart(2, '0');
}

async function generateWeekSlots(startDate) {
    showLoadingIndicator();
    try {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        await fetchAvailableSlots(startDate.toISOString(), endDate.toISOString());

        createWeekDays();

        const slotsContainer = document.getElementById("time-slots");
        slotsContainer.innerHTML = "";

        for (let hour = workingHours.start; hour < workingHours.end; hour++) {
            const row = document.createElement("div");
            row.classList.add("time-label");
            row.textContent = `${hour}:00 - ${hour + 1}:00`;
            slotsContainer.appendChild(row);

            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(currentWeekStart);
                currentDate.setDate(currentDate.getDate() + i); // Änderung hier
                currentDate.setUTCHours(hour, 0, 0, 0);
                const slotKey = formatDateForKey(currentDate);

                const cell = document.createElement("div");

                if (availability[slotKey]) {
                    cell.className = "bookable";
                    cell.textContent = "Frei";
                    cell.onclick = async () => {
                        cell.onclick = null;
                        await bookSlot(currentDate, hour);
                    };
                } else {
                    cell.className = "booked";
                    cell.textContent = "Belegt";
                }

                slotsContainer.appendChild(cell);
            }
        }

    } catch (error) {
        console.error("Fehler beim Generieren der Slots:", error);
    } finally {
        hideLoadingIndicator();
    }
}

async function bookSlot(date, hour) {
    const start = new Date(date);
    start.setUTCHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(hour + 1);

    // Verwende das gleiche Format wie in formatDateForKey
    const startString = formatDateForKey(start);
    const endString = formatDateForKey(end);

    showLoadingIndicator();
    try {
        const response = await fetch("/book", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: startString,
                end: endString,
            }),
        });

        if (response.ok) {
            alert(`Termin gebucht: ${start.toLocaleDateString()} ${hour}:00 - ${hour + 1}:00`);
        } else {
            const error = await response.json();
            alert(`Fehler: ${error.error}`);
        }
    } catch (error) {
        console.error("Buchung fehlgeschlagen:", error);
        alert("Es gab ein Problem bei der Buchung. Bitte versuchen Sie es erneut.");
    } finally {
        await generateWeekSlots(currentWeekStart);
        hideLoadingIndicator();
    }
}

function updateWeekDisplay() {
    const start = new Date(currentWeekStart);
    const weekNumber = getWeekNumber(start);
    document.getElementById("current-week").textContent = `KW ${weekNumber}`;
}

document.getElementById("prev-week").onclick = async () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    await generateWeekSlots(currentWeekStart);
    updateWeekDisplay();
};

document.getElementById("next-week").onclick = async () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    await generateWeekSlots(currentWeekStart);
    updateWeekDisplay();
};

function getWeekNumber(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000));
    return weekNumber;
}

document.addEventListener("DOMContentLoaded", async () => {
    updateWeekDisplay();
    await generateWeekSlots(currentWeekStart);
});
