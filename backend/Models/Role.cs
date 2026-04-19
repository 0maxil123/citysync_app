public class Role
{
    public int Id { get; set; }
    public string Name { get; set; } // "Admin", "Redakteur", "Techniker"
    
    // Die Liste der Rechte, die diese Rolle hat
    public List<RolePermission> RolePermissions { get; set; }
}