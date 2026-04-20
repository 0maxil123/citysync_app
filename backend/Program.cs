using CitySyncApi;

var builder = WebApplication.CreateBuilder(args);

// --- 1. SERVICES HINZUFÜGEN ---

builder.Services.AddControllers();
builder.Services.AddSignalR(); // <--- DIESE ZEILE NEU HINZUFÜGEN

// CORS erlauben: Das ist die "Baugenehmigung", damit React mit C# reden darf
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
    {
        policy.AllowAnyOrigin()   // Erlaubt Anfragen von jeder Quelle (gut für Dev)
              .AllowAnyMethod()   // Erlaubt GET, POST, PUT, DELETE
              .AllowAnyHeader();  // Erlaubt alle Header-Infos
    });
});

// OpenAPI/Swagger für die Test-Oberfläche
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Fügt unseren neuen Nachtwächter hinzu
builder.Services.AddHostedService<CitySyncApi.Services.ScheduleWorker>();


var app = builder.Build();
app.UseCors("AllowAll"); // WICHTIG: Das muss vor app.MapControllers() stehen!

// --- 2. PIPELINE KONFIGURIEREN ---

// Datenbank initialisieren (Erstellt die Datei CitySync.db, falls nicht vorhanden)
DatabaseMonitors.InitializeDatabase();

if (app.Environment.IsDevelopment())
{
    // Swagger Test-Oberfläche aktivieren
    app.UseSwagger();
    app.UseSwaggerUI();
}

// WICHTIG: CORS muss vor Authorization und MapControllers kommen!
app.UseCors("AllowReact");
app.UseStaticFiles();

// Für den Anfang im lokalen Netzwerk kannst du HTTPS-Redirection lassen oder auskommentieren
// app.UseHttpsRedirection(); 

app.UseAuthorization();
app.MapControllers();
app.MapHub<CitySync.Hubs.PlayerHub>("/playerHub");  

app.Run();