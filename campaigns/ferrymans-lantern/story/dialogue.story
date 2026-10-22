== wren
if quest:find-ilse = done
  - The whole village owes you, traveller. Look at the green! #line:AD1CFFFBC830E7E409190E97FBA27E6B
  stop
if quest:find-ilse
  cycle wren-reminder
    * - Any word of Ilse? The ford first, then the {Old Quarry}. #line:54A968F2B077295486112C0BF1D13950
    * - Hollis will see to the bridge. He is slow, but he is sure. #line:77170E96C53CD698EAC068EF5DA0891B
  stop
- Ah, a traveller. Millbrook has a favour to ask of you. #line:4E7803B69703EBCB43224D1BE7F09492
- Ilse the ferryman rowed east to the {Old Quarry} three nights ago, with the {ferry lantern}. She has not come back. #line:8AEBBB53AA22322C50B0140C7A19C444
- Without the lantern nobody crosses the Wolf Ford after dark. #line:26E8F4703623E68501AC57E136AF302E
choice Would you look for her? #line:0957D2029292F960DA799BE00CF9D990
  > I will find her #line:78D0E5170EAF6CC458AFD37C90C29DBF
    - Bless you. The bridge on the Mill Road is out — ask {Hollis} at his workshop. #line:E58A3A06EDE45E18164EED1404551725
    quest find-ilse stage asked
  > Not today #line:9ED0F13308600087AF8FE8ECEE95889D
    - Then the ford stays dark. Come back if your feet change their mind. #line:A8023FD2F8ECE135C3C6132130904229

== hollis
if bridge-mended
  - She'll hold. I built that span to outlast me. #line:797D78A63C1F58ECEBFE4B52105B879B
  stop
if hollis-at-ford
  - The planks are in the water and the pegs are cut. Walk up to the bank when you're ready. #line:05419DB370BF1D3BE893B77CE4D015D8
  stop
if not quest:find-ilse
  - The ford bridge? The spring flood took the middle span clean away. #line:0D09B575C03BC8F2C4E27A1C0534FDD1
  - Not much point mending it with nobody to cross. #line:7407BF3AB0FF4BE9E3476AB1BE5487AD
  stop
if item:plank >= 3
  - Three good oak planks! That will do it. #line:347F79411C8DA25A0F7CCC9B07CD9C5D
  take plank 3
  - Meet me at the Wolf Ford. Mind you don't fall in before I've finished. #line:C697A18645A02E1264261A6403E17A57
  cutscene
  camera hollis 0.8
  walk hollis east-road run
  set hollis-at-ford
  camera reset 1
  stop
once hollis-asks
  - For Ilse's sake I'll mend it. But the flood took my timber too. #line:68DB4DD02440007F4449F537A6EC5983
  - Bring me three {oak planks}: the miller stacks them by the east road to dry. #line:5813A1E094954E3933CBD10C3664096A
  quest find-ilse stage planks
  stop
- Three {oak planks}, from the stack by the east road. You have ${item:plank}. #line:7D76577ED50AFE0D3B02193F0C1191E3

== odo
- Flour, flour, always flour. And rats in the cellar, which is why I keep it locked. #line:25483E7C0FBD9E588F73A092435716C7
loop
  choice What brings you to the mill? #line:D02AAA1DEB07E747ED7F97DB1027E637
    > [once] Rats? #line:4C6621992A7299CDA47014BFF0B5275E
      - Big as cats. Bigger than {my} cat, anyway. #line:D86E6CCE29659D0C0B3427378E343530
    > [if quest:find-ilse and not item:cellar-key] I'm looking for Ilse. #line:C794901A345A5C11296097A0972AD8C8
      - Ilse? She keeps an old ferry chart pinned up in my cellar. Here — the {cellar key}. #line:A25C8C7710907251ECB645AC376C90B0
      give cellar-key
      break
    > Good day. #line:9F43FE46DD116C2813A442FD92C4107A
      - Mind the flour. #line:1CC50FEBC77F31136B93B31AD8759B89
      break

== ilse
if quest:find-ilse = done
  - The ford is lit again. If you are ever this way after dark, I will row you over myself. #line:7DFD012BE0DE9FB400096BF9864CEEF0
  choice
    > Will you row me across tonight? #line:B03EE70B6C39FD6CD921FE1ECA242F0B
      - Tonight? Under all these lanterns? Climb in. #line:F6042F3E8884F3ECD0B4F9276B53E3AF
      ending lanterns-home The Lantern Home #line:C6B2FD28F21C15E4FD321BA19DE3B264
    > Another night. #line:E8D87B48D181D35E0B7B331CEDC0E317
      - Another night, then. #line:963E9D98F62390688E86F1957E9404DE
  stop
if lantern-found
  - Let's take it home. Millbrook will want to see it burning. #line:6518B087C800A90ECD77162FEE9E26C5
  stop
- You came all this way? The slimes cornered me up here when the flood came through. #line:9C6C6FC3039BF625695E89FFF2A768F2
- The {ferry lantern} is safe — I kept it lit the whole time. Look. #line:A9F11163588E9C978A65F1FA586D064C
emote ilse ! 1.2
give ferry-lantern
set lantern-found
quest find-ilse stage found
- Let's take it home. Millbrook will want to see it burning. #line:8266B5C43B77CFA2A7EB2F89ADDD8E6A

== ford-scene
cutscene
face player right
camera hollis 1.2
Hollis: There you are! Stand back from the bank. #line:24929021F3DB9B54360A321D2458CB03
fade out 0.6
sfx chime
set bridge-mended
quest find-ilse stage bridge
wait 0.6
fade in 0.8
camera ford_bridge 1.2
emote hollis note
Hollis: Good as new. Better, even. Go and find her. #line:2A4E7CDC0BA793064C1F0103BF904CDF
camera reset 1

== quarry-cleared
camera ilse 1
emote ilse !
Ilse: Up here! The stair is round the east side of the rock. #line:513C85508F423F76B11EBE65616FADCC
camera reset 1

== ferry-chart
if item:ferry-chart
  : The beam where the chart hung is bare. #line:7BF4A5F67EBE6F70ED5FA4618E559EBA
  stop
: An old chart of the river, pinned to a beam. A note in Ilse's hand: #line:4D66368FEF8317E8B318D6C63F1274FD
: {"If the ford floods, wait it out on the quarry ledge."} #line:C763E461BF7833146EA8A937ECF15704
give ferry-chart

== welcome-home
cutscene
camera green-centre 1.5
walk ilse green-centre
face ilse down
Elder Wren: Ilse! Thank the river. #line:A7055D80AF2C7FB2B56ACCB47D799C81
Ilse: I said I would bring it home, didn't I? #line:764C9A6793C99C1099055BFCCAC13940
emote pip heart
Pip: The lantern! I'm ringing the bell! #line:232AA7B8644C88F815EF1036B67CA447
quest find-ilse stage home
quest find-ilse done
home ilse
camera reset 1.2
