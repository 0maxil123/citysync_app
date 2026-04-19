using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System;
using System.Collections.Generic;

namespace CitySync.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=CitySync.db";

        public class LoginRequest
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var command = connection.CreateCommand();

                    // 1. Prüfen, ob E-Mail und Passwort stimmen
                    command.CommandText = @"
                        SELECT u.Id, u.Name, u.Email, r.Name as RoleName, r.Id as RoleId 
                        FROM Users u
                        JOIN Roles r ON u.RoleId = r.Id
                        WHERE u.Email = @email AND u.PasswordHash = @password";
                    
                    command.Parameters.AddWithValue("@email", request.Email);
                    command.Parameters.AddWithValue("@password", request.Password);

                    using (var reader = command.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            var userId = reader.GetInt32(0);
                            var roleId = reader.GetInt32(4);
                            
                            // 2. Rechte (Permissions) für diesen Nutzer aus der Datenbank holen
                            var permissions = new List<string>();
                            var permCommand = connection.CreateCommand();
                            permCommand.CommandText = @"
                                SELECT p.PermissionKey 
                                FROM RolePermissions rp
                                JOIN Permissions p ON rp.PermissionId = p.Id
                                WHERE rp.RoleId = @roleId";
                            permCommand.Parameters.AddWithValue("@roleId", roleId);

                            using (var permReader = permCommand.ExecuteReader())
                            {
                                while (permReader.Read())
                                {
                                    permissions.Add(permReader.GetString(0));
                                }
                            }

                            // 3. LastLogin in der Datenbank aktualisieren
                            var updateCommand = connection.CreateCommand();
                            updateCommand.CommandText = "UPDATE Users SET LastLogin = CURRENT_TIMESTAMP WHERE Id = @id";
                            updateCommand.Parameters.AddWithValue("@id", userId);
                            updateCommand.ExecuteNonQuery();

                            // 4. Alles als JSON an React zurückschicken
                            return Ok(new
                            {
                                id = userId,
                                name = reader.GetString(1),
                                email = reader.GetString(2),
                                role = reader.GetString(3),
                                permissions = permissions // z.B. ["media.upload", "screens.view"]
                            });
                        }
                        else
                        {
                            return Unauthorized(new { message = "E-Mail oder Passwort falsch!" });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Server-Fehler beim Login", error = ex.Message });
            }
        }
    }
}