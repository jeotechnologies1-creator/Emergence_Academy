if (!(await PermissionService.can("users.view"))) {
    // show an access denied message or redirect
}