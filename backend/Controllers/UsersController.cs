using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System.Collections.Generic;
using System;
using CitySync.DTOs;

namespace CitySync.Controllers 
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=CitySync.db"; 

        // =========================================================================
        // DER TÜRSTEHER: Prüft, ob der User das Recht hat
        // =========================================================================
        private bool HasPermission(string userIdStr, string permissionKey)
        {
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId)) 
                return false;

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var cmd = connection.CreateCommand();
                
                cmd.CommandText = @"
                    SELECT COUNT(*) 
                    FROM Users u
                    JOIN Roles r ON u.RoleId = r.Id
                    LEFT JOIN RolePermissions rp ON r.Id = rp.RoleId
                    LEFT JOIN Permissions p ON rp.PermissionId = p.Id
                    WHERE u.Id = @userId AND (p.PermissionKey = @permKey OR r.Name = 'Administrator')";
                    
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@permKey", permissionKey);

                long count = (long)cmd.ExecuteScalar();
                return count > 0;
            }
        }

        // =========================================================================
        // USER MANAGEMENT
        // =========================================================================
        
        [HttpGet]
        public IActionResult GetUsers([FromQuery] string userId)
        {
            if (!HasPermission(userId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            var users = new List<object>();
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var command = connection.CreateCommand();
                    
                    command.CommandText = @"
                        SELECT u.Id, u.Name, u.Email, u.LastLogin, r.Name as RoleName 
                        FROM Users u
                        JOIN Roles r ON u.RoleId = r.Id";

                    using (var reader = command.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            users.Add(new
                            {
                                id = reader.GetInt32(0),
                                name = reader.GetString(1),
                                email = reader.GetString(2),
                                lastLogin = reader.IsDBNull(3) ? "Nie" : reader.GetDateTime(3).ToString("dd.MM.yyyy HH:mm"),
                                role = reader.GetString(4) 
                            });
                        }
                    }
                }
                return Ok(users);
            }
            catch (Exception ex) { return StatusCode(500, new { message = "Fehler beim Laden der Benutzer", error = ex.Message }); }
        }

        public class CreateUserDto
        {
            public string UserId { get; set; } // <--- NEU für den Türsteher
            public string Name { get; set; }
            public string Email { get; set; }
            public string Password { get; set; }
            public int RoleId { get; set; }
        }

        [HttpPost]
        public IActionResult CreateUser([FromBody] CreateUserDto newUser)
        {
            if (!HasPermission(newUser.UserId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var command = connection.CreateCommand();

                    command.CommandText = @"
                        INSERT INTO Users (Name, Email, PasswordHash, RoleId) 
                        VALUES (@name, @email, @password, @roleId)";
                    
                    command.Parameters.AddWithValue("@name", newUser.Name);
                    command.Parameters.AddWithValue("@email", newUser.Email);
                    command.Parameters.AddWithValue("@password", newUser.Password);
                    command.Parameters.AddWithValue("@roleId", newUser.RoleId);

                    command.ExecuteNonQuery();
                }
                return Ok(new { message = "Benutzer erfolgreich angelegt!" });
            }
            catch (Exception ex) { return StatusCode(500, new { message = "Fehler beim Anlegen", error = ex.Message }); }
        }

        // =========================================================================
        // ROLLEN & RECHTE MANAGEMENT
        // =========================================================================

        [HttpGet("roles-with-permissions")]
        public IActionResult GetRolesWithPermissions([FromQuery] string userId)
        {
            if (!HasPermission(userId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            var roles = new List<object>();
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                
                var roleCmd = connection.CreateCommand();
                roleCmd.CommandText = "SELECT Id, Name FROM Roles";
                using (var reader = roleCmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var roleId = reader.GetInt32(0);
                        var perms = new List<string>();
                        
                        var permCmd = connection.CreateCommand();
                        permCmd.CommandText = @"
                            SELECT p.PermissionKey FROM RolePermissions rp 
                            JOIN Permissions p ON rp.PermissionId = p.Id 
                            WHERE rp.RoleId = @roleId";
                        permCmd.Parameters.AddWithValue("@roleId", roleId);
                        using (var pReader = permCmd.ExecuteReader())
                        {
                            while (pReader.Read()) perms.Add(pReader.GetString(0));
                        }

                        roles.Add(new { id = roleId, name = reader.GetString(1), permissions = perms });
                    }
                }
            }
            return Ok(roles);
        }

        [HttpPost("update-role-permissions")]
        public IActionResult UpdateRolePermissions([FromBody] RoleUpdateDto data) 
        {
            // WICHTIG: Füge in deiner DTO Datei bei RoleUpdateDto 'public string UserId { get; set; }' hinzu!
            if (!HasPermission(data.UserId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try {
                        var delCmd = connection.CreateCommand();
                        delCmd.CommandText = "DELETE FROM RolePermissions WHERE RoleId = @roleId";
                        delCmd.Parameters.AddWithValue("@roleId", data.RoleId);
                        delCmd.ExecuteNonQuery();

                        foreach (var pKey in data.Permissions) {
                            var insCmd = connection.CreateCommand();
                            insCmd.CommandText = @"
                                INSERT INTO RolePermissions (RoleId, PermissionId) 
                                SELECT @roleId, Id FROM Permissions WHERE PermissionKey = @pKey";
                            insCmd.Parameters.AddWithValue("@roleId", data.RoleId);
                            insCmd.Parameters.AddWithValue("@pKey", pKey);
                            insCmd.ExecuteNonQuery();
                        }
                        transaction.Commit();
                        return Ok(new { message = "Update erfolgreich" });
                    } catch (Exception ex) { 
                        transaction.Rollback(); 
                        return StatusCode(500, ex.Message); 
                    }
                }
            }
        }

        [HttpPost("roles")]
        public IActionResult CreateRole([FromBody] string roleName, [FromQuery] string userId)
        {
            if (!HasPermission(userId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");
            if (string.IsNullOrWhiteSpace(roleName)) return BadRequest("Name fehlt");

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "INSERT INTO Roles (Name) VALUES (@name)";
                command.Parameters.AddWithValue("@name", roleName);
                
                try {
                    command.ExecuteNonQuery();
                    return Ok(new { message = "Rolle erstellt" });
                } catch {
                    return BadRequest("Rolle existiert bereits");
                }
            }
        }

        [HttpDelete("roles/{id}")]
        public IActionResult DeleteRole(int id, [FromQuery] string userId)
        {
            if (!HasPermission(userId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");
            if (id <= 3) return BadRequest("Systemrollen können nicht gelöscht werden.");

            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();

                var checkCmd = connection.CreateCommand();
                checkCmd.CommandText = "SELECT COUNT(*) FROM Users WHERE RoleId = @id";
                checkCmd.Parameters.AddWithValue("@id", id);
                long userCount = (long)checkCmd.ExecuteScalar();

                if (userCount > 0) 
                    return BadRequest("Rolle wird noch von Benutzern verwendet und kann nicht gelöscht werden.");

                var delCmd = connection.CreateCommand();
                delCmd.CommandText = "DELETE FROM Roles WHERE Id = @id";
                delCmd.Parameters.AddWithValue("@id", id);
                delCmd.ExecuteNonQuery();
            }
            return Ok();
        }
        [HttpDelete("{id}")]
        public IActionResult DeleteUser(int id, [FromQuery] string userId)
        {
            // 1. TÜRSTEHER FRAGEN
            if (!HasPermission(userId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            // 2. LOGIK-CHECK: Man darf sich nicht selbst löschen
            if (userId == id.ToString()) return BadRequest("Man kann sich nicht selbst löschen.");

            // 3. LOGIK-CHECK: Systemadministrator schützen (optional, falls ID 1 dein unlöschbarer Gott-Admin ist)
            if (id == 1) return BadRequest("Der primäre Systemadministrator kann nicht gelöscht werden.");

            // 4. LÖSCHEN
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    cmd.CommandText = "DELETE FROM Users WHERE Id = @id";
                    cmd.Parameters.AddWithValue("@id", id);
                    int rowsAffected = cmd.ExecuteNonQuery();

                    if (rowsAffected == 0) return NotFound("Benutzer nicht gefunden.");
                }
                return Ok(new { message = "Benutzer gelöscht" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Fehler beim Löschen", error = ex.Message });
            }
        }
        [HttpPut("{id}")]
        public IActionResult UpdateUser(int id, [FromBody] UpdateUserDto data)
        {
            if (!HasPermission(data.UserId, "users.manage")) return StatusCode(403, "Keine Berechtigung.");

            try {
                using (var connection = new SqliteConnection(_connectionString)) {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    cmd.CommandText = @"
                        UPDATE Users 
                        SET Name = @name, Email = @email, RoleId = @roleId 
                        WHERE Id = @id";
                    
                    cmd.Parameters.AddWithValue("@name", data.Name);
                    cmd.Parameters.AddWithValue("@email", data.Email);
                    cmd.Parameters.AddWithValue("@roleId", data.RoleId);
                    cmd.Parameters.AddWithValue("@id", id);

                    cmd.ExecuteNonQuery();
                }
                return Ok(new { message = "Update erfolgreich" });
            } catch (Exception ex) { return StatusCode(500, ex.Message); }
        }


    }
}