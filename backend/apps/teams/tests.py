"""
Tests for the teams app.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import Team, TeamMember, TeamRole, TeamType, TeamColor
from .services import TeamService, TeamMemberService, TeamServiceError

User = get_user_model()


class TeamModelTests(TestCase):
    """Tests for Team model."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email="test@example.com",
            password="testpass123"
        )
        self.team = Team.objects.create(
            name="Test Team",
            team_type=TeamType.DEVELOPMENT,
            color=TeamColor.BLUE,
            leader=self.user
        )
        TeamMember.objects.create(
            team=self.team,
            user=self.user,
            role=TeamRole.OWNER
        )
    
    def test_team_creation(self):
        """Test team is created correctly."""
        self.assertEqual(self.team.name, "Test Team")
        self.assertEqual(self.team.team_type, TeamType.DEVELOPMENT)
        self.assertEqual(self.team.leader, self.user)
    
    def test_team_soft_delete(self):
        """Test soft delete functionality."""
        self.team.soft_delete()
        
        # Should not appear in default queryset
        self.assertFalse(Team.objects.filter(id=self.team.id).exists())
        
        # Should appear in all_objects
        self.assertTrue(Team.all_objects.filter(id=self.team.id).exists())
    
    def test_team_restore(self):
        """Test restore functionality."""
        self.team.soft_delete()
        self.team.restore()
        
        self.assertTrue(Team.objects.filter(id=self.team.id).exists())
    
    def test_is_member(self):
        """Test is_member method."""
        self.assertTrue(self.team.is_member(self.user))
        
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123"
        )
        self.assertFalse(self.team.is_member(other_user))
    
    def test_get_user_role(self):
        """Test get_user_role method."""
        self.assertEqual(
            self.team.get_user_role(self.user),
            TeamRole.OWNER
        )
    
    def test_can_user_manage(self):
        """Test can_user_manage method."""
        self.assertTrue(self.team.can_user_manage(self.user))
        
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123"
        )
        self.assertFalse(self.team.can_user_manage(other_user))


class TeamServiceTests(TestCase):
    """Tests for TeamService."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email="creator@example.com",
            password="testpass123"
        )
    
    def test_create_team(self):
        """Test team creation via service."""
        team = TeamService.create_team(
            name="New Team",
            creator=self.user,
            team_type=TeamType.QA,
            color=TeamColor.RED,
            description="Test description"
        )
        
        self.assertEqual(team.name, "New Team")
        self.assertEqual(team.team_type, TeamType.QA)
        self.assertEqual(team.leader, self.user)
        self.assertTrue(team.is_member(self.user))
        self.assertEqual(team.get_user_role(self.user), TeamRole.OWNER)
    
    def test_create_team_with_members(self):
        """Test team creation with initial members."""
        member1 = User.objects.create_user(
            email="member1@example.com",
            password="testpass123"
        )
        member2 = User.objects.create_user(
            email="member2@example.com",
            password="testpass123"
        )
        
        team = TeamService.create_team(
            name="Team with Members",
            creator=self.user,
            member_ids=[member1.id, member2.id]
        )
        
        self.assertTrue(team.is_member(self.user))
        self.assertTrue(team.is_member(member1))
        self.assertTrue(team.is_member(member2))
        self.assertEqual(team.member_count, 3)
    
    def test_create_team_with_different_leader(self):
        """Test team creation with a different leader."""
        leader = User.objects.create_user(
            email="leader@example.com",
            password="testpass123"
        )
        
        team = TeamService.create_team(
            name="Team with Leader",
            creator=self.user,
            leader_id=leader.id
        )
        
        self.assertEqual(team.leader, leader)
        self.assertTrue(team.is_member(self.user))
        self.assertTrue(team.is_member(leader))
        self.assertEqual(team.get_user_role(self.user), TeamRole.OWNER)
        self.assertEqual(team.get_user_role(leader), TeamRole.MANAGER)


class TeamMemberServiceTests(TestCase):
    """Tests for TeamMemberService."""
    
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="testpass123"
        )
        self.team = TeamService.create_team(
            name="Test Team",
            creator=self.owner
        )
    
    def test_add_member(self):
        """Test adding a member to a team."""
        new_user = User.objects.create_user(
            email="newuser@example.com",
            password="testpass123"
        )
        
        member = TeamMemberService.add_member(
            team=self.team,
            user=new_user,
            role=TeamRole.MEMBER,
            added_by=self.owner
        )
        
        self.assertEqual(member.user, new_user)
        self.assertEqual(member.role, TeamRole.MEMBER)
        self.assertTrue(self.team.is_member(new_user))
    
    def test_add_duplicate_member(self):
        """Test adding a duplicate member raises error."""
        new_user = User.objects.create_user(
            email="newuser@example.com",
            password="testpass123"
        )
        
        TeamMemberService.add_member(
            team=self.team,
            user=new_user,
            added_by=self.owner
        )
        
        with self.assertRaises(TeamServiceError):
            TeamMemberService.add_member(
                team=self.team,
                user=new_user,
                added_by=self.owner
            )
    
    def test_remove_member(self):
        """Test removing a member from a team."""
        new_user = User.objects.create_user(
            email="newuser@example.com",
            password="testpass123"
        )
        
        TeamMemberService.add_member(
            team=self.team,
            user=new_user,
            added_by=self.owner
        )
        
        TeamMemberService.remove_member(
            team=self.team,
            user=new_user,
            removed_by=self.owner
        )
        
        self.assertFalse(self.team.is_member(new_user))
    
    def test_cannot_remove_last_owner(self):
        """Test that the last owner cannot be removed."""
        with self.assertRaises(TeamServiceError):
            TeamMemberService.remove_member(
                team=self.team,
                user=self.owner,
                removed_by=self.owner
            )


class TeamAPITests(APITestCase):
    """Tests for Team REST API."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            email="api@example.com",
            password="testpass123"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_create_team(self):
        """Test creating a team via API."""
        data = {
            "name": "API Team",
            "team_type": "development",
            "color": "#3b82f6",
            "description": "Created via API"
        }
        
        response = self.client.post("/api/v1/teams/", data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "API Team")
        self.assertEqual(response.data["my_role"], TeamRole.OWNER)
    
    def test_list_teams(self):
        """Test listing user's teams."""
        TeamService.create_team(
            name="Team 1",
            creator=self.user
        )
        TeamService.create_team(
            name="Team 2",
            creator=self.user
        )
        
        response = self.client.get("/api/v1/teams/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)
    
    def test_get_team_detail(self):
        """Test getting team details."""
        team = TeamService.create_team(
            name="Detail Team",
            creator=self.user
        )
        
        response = self.client.get(f"/api/v1/teams/{team.id}/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Detail Team")
        self.assertIn("members", response.data)
    
    def test_update_team(self):
        """Test updating a team."""
        team = TeamService.create_team(
            name="Original Name",
            creator=self.user
        )
        
        response = self.client.patch(
            f"/api/v1/teams/{team.id}/",
            {"name": "Updated Name"}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Name")
    
    def test_delete_team(self):
        """Test deleting a team."""
        team = TeamService.create_team(
            name="Delete Me",
            creator=self.user
        )
        
        response = self.client.delete(f"/api/v1/teams/{team.id}/")
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Team.objects.filter(id=team.id).exists())
    
    def test_choices_endpoint(self):
        """Test choices endpoint returns valid data."""
        response = self.client.get("/api/v1/teams/choices/")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("team_types", response.data)
        self.assertIn("colors", response.data)
        self.assertIn("roles", response.data)
