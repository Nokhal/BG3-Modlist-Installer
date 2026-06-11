# BG3 Modlist Installer

## For users 

Extract the zip file to a new folder with enough disk space, then double-click launchme.bat

Then follow the on-screen instructions.

Click the import button to install a modlist you've downloaded from another source

## For modlist creators

A modlist is a JSON file. You can find an example [here](BG3AFR/ModLists/Nokhalsmodlist.json)

The structure of a modlist is as foollow : 

{
    "Name" : The display name of your modlist
    "Description" : The description of your modlist, to remind users what they do
    "LastUpdated" : The date at which you last checked the modlist worked and the mods are in their latest version. YYYY-MM-DD format
    "ModList": [   : An Array of mods to download and install
        {
            "ModName": The mod name as it appear in the install interface
            "ModPage": The page where a user could manually go download the mod/find help
            "DLLink": If not downloading from nexus, a direct link to download the mod
            "filename": If your mod is a simple zip, automatically populated by the modlist installer. 
            "source": Valid values are "mod.io", "rpghq.org", "nexusmods.com". If neither of those, use "rpghq.org"
            "pakfile": Automatically populated if your mod is a flat zip with a pakfile inside
            "NexusFileId": The ID of the file on nexus, as DLLink cannot be used
            "isNotPak" : Set to true if your mod is not a flat zip/rar with a pakfile inside
            "contentTo" : in the event that isNotPak is set to true, which path to install your file. Leave blank for the BG3 mod folder, "gameroot" for the game root,  "gameroot//bin" for the bin folder in the game root folder, etc...
            "fileToCheck": "gameroot//bin//DWrite.dll" : Optional if you don't want user re-extracting all the time. Give the path of a unique file that was ectrated from the mod archive
        }
    ]
}