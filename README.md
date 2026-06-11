# BG3 Modlist Installer

A user-friendly modlist installer that allows you to download and install Baldur's Gate 3 modlists from multiple mod websites with just a few clicks

## For users 

Extract the zip file to a new folder with enough disk space, then double-click launchme.bat

Then follow the on-screen instructions.

Click the import button to install a modlist you've downloaded from another source

## For modlist creators

A modlist is a JSON file. You can find an example [here](BG3AFR/ModLists/Nokhalsmodlist.json)

The structure of a modlist is as follows:

```json
{
  "Name": "The display name of your modlist",
  "Description": "The description of your modlist, to remind users what they do",
  "LastUpdated": "The date at which you last checked the modlist worked and the mods are in their latest version. YYYY-MM-DD format",
  "ModList": [
    {
      "ModName": "The mod name as it appears in the install interface",
      "ModPage": "The page where a user could manually download the mod/find help",
      "DLLink": "If not downloading from nexus, a direct link to download the mod",
      "filename": "If your mod is a simple zip, automatically populated by the modlist installer",
      "source": "Valid values are 'mod.io', 'rpghq.org', 'nexusmods.com'. If neither, use 'rpghq.org'",
      "pakfile": "Automatically populated if your mod is a flat zip with a pakfile inside",
      "NexusFileId": "The ID of the file on nexus, as DLLink cannot be used",
      "isNotPak": "Set to true if your mod is not a flat zip/rar with a pakfile inside",
      "contentTo": "Path to install your file. Leave blank for BG3 mod folder, 'gameroot' for game root, 'gameroot/bin' for bin folder, etc",
      "fileToCheck": "Optional - the path of a unique file extracted from the mod archive to avoid re-extracting"
    }
  ],
  "localFilesToCopyArray": "Leave it like in the example to force the download of scriptExtender V32, required by certain mods",
  "modsettingslsxBase64": "See Instructions below"
}
```
### How to create the Load Order Base64 string

- Create your entire modlist except this attribute 
- Install it using this software
- Before clicking Set Load Order, launch BG3ModManager.exe
- Setup and save your load Order
- Find the modsettings.lsx file in your `\AppData\Local\Larian Studios\Baldur's Gate 3\PlayerProfiles\Public` folder
- Paste it's entire content in https://www.base64encode.org
- The encoded string is your modsettingslsxBase64 attribute. Don't forget the quotes around it in the JSON