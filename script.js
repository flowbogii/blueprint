// Configuration
const workingHours = { start: 9, end: 14 }; // Working hours per day
const days = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const freeDays = [0, 1, 2, 3, 4]; // Monday to Friday
let currentWeekStart = new Date(); // Start of the current week

// Adjust currentWeekStart to the start of the week (Monday)
while (currentWeekStart.getDay() !== 1) {
    currentWeekStart.setDate(currentWeekStart.getDate() - 1);
}



function showLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "flex"; // Ladeoverlay anzeigen
    document.body.classList.add("loading"); // Blur-Effekt aktivieren
}

function hideLoadingIndicator() {
    document.getElementById("loading-overlay").style.display = "none"; // Ladeoverlay ausblenden
    document.body.classList.remove("loading"); // Blur-Effekt deaktivieren
}


let availability = {}; // Globale Definition von availability

async function fetchAvailableSlots() {
    showLoadingIndicator(); // Ladeindikator anzeigen
    try {
        const response = await fetch("http://127.0.0.1:5000/available");
        availability = await response.json(); // Globale Variable aktualisieren
        console.log("API response (Verfügbare Slots):", availability);
    } catch (error) {
        console.error("Fehler beim Abrufen der verfügbaren Slots:", error);
        availability = {}; // Rückgabe eines leeren Objekts bei Fehler
    } finally {
        hideLoadingIndicator(); // Ladeindikator ausblenden
    }
}





async function bookSlot(date, hour) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1);

    showLoadingIndicator(); // Ladeindikator anzeigen
    try {
        const response = await fetch("http://127.0.0.1:5000/book", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: start.toISOString(),
                end: end.toISOString(),
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
        alert("Es gab ein Problem bei der Buchung. Bitte versuche es erneut.");
    } finally {
        await fetchAvailableSlots(); // Slots neu laden
        generateWeekSlots(currentWeekStart); // Kalender aktualisieren
        hideLoadingIndicator(); // Ladeindikator ausblenden
    }
}




async function generateWeekSlots(startDate) {
    showLoadingIndicator(); // Ladeindikator anzeigen
    try {
        const weekDayContainer = document.getElementById("week-days");
        weekDayContainer.innerHTML = ""; //Clear previous days
        weekDayContainer.appendChild(document.createElement("div"));

        for(let day = 0; day < 7; day++){
            const currentDate = new Date(currentWeekStart);
            console.log("currentDate " + currentDate);
            currentDate.setDate(currentDate.getDate() + day);

            console.log("currentDate + day " + currentDate);

            const cell = document.createElement("div");
            cell.innerHTML = "<p>" + days[day] + "<br>" + currentDate.toLocaleString("fr-CH").substr(0,10) + "</p>";

            weekDayContainer.appendChild(cell);
        }

        const slotsContainer = document.getElementById("time-slots");
        slotsContainer.innerHTML = ""; // Clear previous slots

        for (let hour = workingHours.start; hour < workingHours.end; hour++) {
            const row = document.createElement("div");
            row.textContent = `${hour}-${hour + 1} Uhr`;
            slotsContainer.appendChild(row);

            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + day);
                currentDate.setHours(hour, 0, 0, 0);
                const slotKey = currentDate.toISOString().substr(0, 19); // Schlüssel für den Slot

                const cell = document.createElement("div");
                console.log(`Prüfe Slot: ${slotKey} - Verfügbarkeit: ${availability[slotKey]}`); // Debugging

                if (availability[slotKey]) {
                    cell.className = "bookable";
                    cell.textContent = "Buchen";
                    cell.onclick = async () => {
                        cell.onclick = null; // Deaktivieren, um Mehrfachklicks zu verhindern
                        await bookSlot(currentDate, hour); // Buchung ausführen
                        await fetchAvailableSlots(); // Slots neu laden
                        generateWeekSlots(currentWeekStart); // Kalender aktualisieren
                    };
                } else {
                    cell.className = "booked";
                    cell.textContent = "XXX";
                }

                slotsContainer.appendChild(cell);
            }
        }
    } catch (error) {
        console.error("Fehler beim Generieren der Slots:", error);
    } finally {
        hideLoadingIndicator(); // Ladeindikator ausblenden
    }
}




document.addEventListener("DOMContentLoaded", async () => {
    await fetchAvailableSlots(); // Verfügbare Slots laden
    updateWeekDisplay();
    generateWeekSlots(currentWeekStart);
});

// Update week display
function updateWeekDisplay() {
    const start = new Date(currentWeekStart);
    const weekNumber = getWeekNumber(start);
    document.getElementById("current-week").textContent = `KW ${weekNumber}`;
}

// Handle week navigation
document.getElementById("prev-week").onclick = () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay();
    generateWeekSlots(currentWeekStart);
};

document.getElementById("next-week").onclick = () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay();
    generateWeekSlots(currentWeekStart);
};

// Calculate week number
function getWeekNumber(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Initialize calendar
updateWeekDisplay();
generateWeekSlots(currentWeekStart);
