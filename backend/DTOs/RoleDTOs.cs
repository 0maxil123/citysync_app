namespace CitySync.DTOs
{
    public class RoleUpdateDto
    {
        public string UserId { get; set; }
        public int RoleId { get; set; }
        public List<string> Permissions { get; set; }
    }
    public class UpdateUserDto {
    public string UserId { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public int RoleId { get; set; }
}
}