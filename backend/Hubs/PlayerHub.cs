using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace CitySync.Hubs
{
    public class PlayerHub : Hub
    {
        // Wenn der React-Player startet, ruft er diese Methode auf.
        // Er sagt quasi: "Hallo, ich bin der Monitor mit der ID 12345, bitte halte mich auf dem Laufenden!"
        public async Task RegisterPlayer(string monitorId)
        {
            // Wir stecken diese spezifische Verbindung in eine Gruppe, die so heißt wie die Monitor-ID.
            // So können wir später aus dem Dashboard sagen: "Sende Update an Gruppe '12345'".
            await Groups.AddToGroupAsync(Context.ConnectionId, monitorId);
            
            // Optional: Kleine Bestätigung an den Player zurückschicken
            await Clients.Caller.SendAsync("Registered", $"Erfolgreich für Push-Updates registriert: {monitorId}");
        }
    }
}   